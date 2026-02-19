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

    // 修正1: byProject を groupBy で 1クエリに統合
    const taskStats = await prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });
    const byProject = projects.map((project) => {
      const rows = taskStats.filter((r) => r.projectId === project.id);
      const total = rows.reduce((sum, r) => sum + r._count._all, 0);
      const completed = rows.find((r) => r.status === 'DONE')?._count._all ?? 0;
      return { id: project.id, name: project.name, total, completed, color: project.color };
    });

    // 修正2: recentActivity を 1クエリ + JS側集計に変更
    const fourteenDaysAgo = startOfDay(subDays(now, 13));
    const completedTasksInRange = await prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        completedAt: { gte: fourteenDaysAgo, lte: endOfDay(now) },
      },
      select: { completedAt: true },
    });

    const countByDate = new Map<string, number>();
    for (const { completedAt } of completedTasksInRange) {
      if (!completedAt) continue;
      const key = format(completedAt, 'MM/dd');
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }

    const recentActivity = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(now, 13 - i);
      const key = format(date, 'MM/dd');
      return { date: key, count: countByDate.get(key) ?? 0 };
    });

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
        projectId: true,
        project: { select: { name: true, color: true } },
      },
    });
    // 修正4: upcomingDeadlines に projectId を追加
    const upcomingDeadlines = upcomingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate!.toISOString(),
      priority: t.priority,
      projectId: t.projectId,
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
