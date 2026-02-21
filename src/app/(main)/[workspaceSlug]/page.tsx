import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/dashboard/stat-card';
import { ProjectProgress } from '@/components/dashboard/project-progress';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { DashboardClient } from './dashboard-client';
import { CheckCircle, Clock, AlertCircle, ListTodo } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { getAccessibleProjectIds } from '@/lib/project-access';

export default async function WorkspacePage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: { members: { where: { userId: session.user.id } } },
  });

  if (!workspace || workspace.members.length === 0) redirect('/');

  const now = new Date();
  const accessibleIds = await getAccessibleProjectIds(session.user.id, workspace.id);
  const projects = await prisma.project.findMany({
    where: { id: { in: accessibleIds } },
    select: { id: true, name: true, color: true },
    orderBy: { position: 'asc' },
  });
  const projectIds = projects.map((p) => p.id);

  const [totalTasks, completedTasks, overdueTasks, inProgressTasks] = await Promise.all([
    prisma.task.count({ where: { projectId: { in: projectIds }, status: { not: 'ARCHIVED' } } }),
    prisma.task.count({ where: { projectId: { in: projectIds }, status: 'DONE' } }),
    prisma.task.count({
      where: { projectId: { in: projectIds }, dueDate: { lt: now }, status: { notIn: ['DONE', 'ARCHIVED'] } },
    }),
    prisma.task.count({ where: { projectId: { in: projectIds }, status: 'IN_PROGRESS' } }),
  ]);

  const statusGroups = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId: { in: projectIds }, status: { not: 'ARCHIVED' } },
    _count: { _all: true },
  });
  const byStatus = statusGroups.map((g) => ({ status: g.status, count: g._count._all }));

  const priorityGroups = await prisma.task.groupBy({
    by: ['priority'],
    where: { projectId: { in: projectIds }, status: { not: 'ARCHIVED' } },
    _count: { _all: true },
  });
  const byPriority = priorityGroups.map((g) => ({ priority: g.priority, count: g._count._all }));

  // 修正1: byProject を groupBy で 1クエリに統合
  const taskStats = await prisma.task.groupBy({
    by: ['projectId', 'status'],
    where: { projectId: { in: projectIds }, status: { not: 'ARCHIVED' } },
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

  // ガントチャート用: 各プロジェクトのタスク（日付あり）を取得
  const ganttTasks = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      status: { not: 'ARCHIVED' },
      OR: [{ startDate: { not: null } }, { dueDate: { not: null } }],
    },
    select: {
      id: true,
      title: true,
      priority: true,
      status: true,
      startDate: true,
      dueDate: true,
      projectId: true,
    },
    orderBy: [{ dueDate: 'asc' }, { startDate: 'asc' }],
  });

  const ganttProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    tasks: ganttTasks
      .filter((t) => t.projectId === p.id)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        startDate: t.startDate?.toISOString() ?? null,
        dueDate: t.dueDate?.toISOString() ?? null,
      })),
  }));

  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingTasks = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      dueDate: { gte: now, lte: sevenDaysLater },
      status: { notIn: ['DONE', 'ARCHIVED'] },
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

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <>
      <Header title="ダッシュボード" workspaceSlug={params.workspaceSlug} />
      <div className="flex-1 overflow-auto bg-g-surface p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* 概要カード */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="全タスク"
              value={totalTasks}
              icon={ListTodo}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
            />
            <StatCard
              title="完了タスク"
              value={completedTasks}
              subtitle={`完了率 ${completionRate}%`}
              icon={CheckCircle}
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <StatCard
              title="進行中タスク"
              value={inProgressTasks}
              icon={Clock}
              iconColor="text-yellow-600"
              iconBg="bg-yellow-50"
            />
            <StatCard
              title="期限超過タスク"
              value={overdueTasks}
              icon={AlertCircle}
              iconColor="text-red-600"
              iconBg="bg-red-50"
            />
          </div>

          {/* グラフ（クライアントコンポーネント） */}
          <DashboardClient
            byStatus={byStatus}
            byPriority={byPriority}
            recentActivity={recentActivity}
            completionRate={completionRate}
            ganttProjects={ganttProjects}
          />

          {/* プロジェクト別進捗 + 期限迫るタスク */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ProjectProgress data={byProject} />
            <UpcomingDeadlines data={upcomingDeadlines} workspaceSlug={params.workspaceSlug} />
          </div>
        </div>
      </div>
    </>
  );
}
