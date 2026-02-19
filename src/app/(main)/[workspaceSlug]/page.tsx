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
  const projects = await prisma.project.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, name: true, color: true },
    orderBy: { position: 'asc' },
  });
  const projectIds = projects.map((p) => p.id);

  const [totalTasks, completedTasks, overdueTasks, inProgressTasks] = await Promise.all([
    prisma.task.count({ where: { projectId: { in: projectIds } } }),
    prisma.task.count({ where: { projectId: { in: projectIds }, status: 'DONE' } }),
    prisma.task.count({
      where: { projectId: { in: projectIds }, dueDate: { lt: now }, status: { not: 'DONE' } },
    }),
    prisma.task.count({ where: { projectId: { in: projectIds }, status: 'IN_PROGRESS' } }),
  ]);

  const statusGroups = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });
  const byStatus = statusGroups.map((g) => ({ status: g.status, count: g._count._all }));

  const priorityGroups = await prisma.task.groupBy({
    by: ['priority'],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });
  const byPriority = priorityGroups.map((g) => ({ priority: g.priority, count: g._count._all }));

  const byProject = await Promise.all(
    projects.map(async (project) => {
      const [total, completed] = await Promise.all([
        prisma.task.count({ where: { projectId: project.id } }),
        prisma.task.count({ where: { projectId: project.id, status: 'DONE' } }),
      ]);
      return { name: project.name, total, completed, color: project.color };
    })
  );

  const recentActivity: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = subDays(now, i);
    const count = await prisma.task.count({
      where: {
        projectId: { in: projectIds },
        completedAt: { gte: startOfDay(date), lte: endOfDay(date) },
      },
    });
    recentActivity.push({ date: format(date, 'MM/dd'), count });
  }

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

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <>
      <Header title="ダッシュボード" workspaceSlug={params.workspaceSlug} />
      <div className="flex-1 overflow-auto bg-[#F8F9FA] p-6">
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
