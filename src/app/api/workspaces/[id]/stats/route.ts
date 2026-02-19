import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('ワークスペースが見つかりません', 404);

    const now = new Date();
    const projects = await prisma.project.findMany({
      where: { workspaceId: params.id },
      select: { id: true, name: true, color: true },
    });

    const projectIds = projects.map((p) => p.id);

    // 概要統計
    const [totalTasks, completedTasks, overdueTasks, inProgressTasks] = await Promise.all([
      prisma.task.count({ where: { projectId: { in: projectIds } } }),
      prisma.task.count({ where: { projectId: { in: projectIds }, status: 'DONE' } }),
      prisma.task.count({
        where: {
          projectId: { in: projectIds },
          dueDate: { lt: now },
          status: { not: 'DONE' },
        },
      }),
      prisma.task.count({ where: { projectId: { in: projectIds }, status: 'IN_PROGRESS' } }),
    ]);

    // ステータス別集計
    const statusGroups = await prisma.task.groupBy({
      by: ['status'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });
    const byStatus = statusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    }));

    // 優先度別集計
    const priorityGroups = await prisma.task.groupBy({
      by: ['priority'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });
    const byPriority = priorityGroups.map((g) => ({
      priority: g.priority,
      count: g._count._all,
    }));

    // プロジェクト別進捗
    const byProject = await Promise.all(
      projects.map(async (project) => {
        const [total, completed] = await Promise.all([
          prisma.task.count({ where: { projectId: project.id } }),
          prisma.task.count({ where: { projectId: project.id, status: 'DONE' } }),
        ]);
        return { name: project.name, total, completed, color: project.color };
      })
    );

    // 過去14日の日別完了タスク数
    const recentActivity: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = subDays(now, i);
      const count = await prisma.task.count({
        where: {
          projectId: { in: projectIds },
          completedAt: {
            gte: startOfDay(date),
            lte: endOfDay(date),
          },
        },
      });
      recentActivity.push({ date: format(date, 'MM/dd'), count });
    }

    // 今後7日以内の期限タスク
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingTasks = await prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        dueDate: { gte: now, lte: sevenDaysLater },
        status: { not: 'DONE' },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        project: { select: { name: true, color: true } },
      },
    });
    const upcomingDeadlines = upcomingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate!.toISOString(),
      priority: t.priority,
      projectName: t.project.name,
      projectColor: t.project.color,
    }));

    return successResponse({
      overview: { totalTasks, completedTasks, overdueTasks, inProgressTasks },
      byStatus,
      byPriority,
      byProject,
      recentActivity,
      upcomingDeadlines,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
