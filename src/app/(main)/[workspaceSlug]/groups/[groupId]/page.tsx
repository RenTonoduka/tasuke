import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/dashboard/stat-card';
import { ProjectProgress } from '@/components/dashboard/project-progress';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { CheckCircle, Clock, AlertCircle, ListTodo } from 'lucide-react';

export default async function GroupDashboardPage({
  params,
}: {
  params: { workspaceSlug: string; groupId: string };
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: { members: { where: { userId: session.user.id } } },
  });
  if (!workspace || workspace.members.length === 0) redirect('/');

  const group = await prisma.projectGroup.findUnique({
    where: { id: params.groupId },
    include: {
      projects: {
        orderBy: { position: 'asc' },
        select: { id: true, name: true, color: true },
      },
    },
  });
  if (!group || group.workspaceId !== workspace.id) redirect(`/${params.workspaceSlug}`);

  const projects = group.projects;
  const projectIds = projects.map((p) => p.id);
  const now = new Date();

  if (projectIds.length === 0) {
    return (
      <>
        <Header title={group.name} workspaceSlug={params.workspaceSlug} />
        <div className="flex-1 overflow-auto bg-g-surface p-6">
          <div className="mx-auto max-w-7xl">
            <p className="text-g-text-secondary">このグループにはまだプロジェクトがありません。</p>
          </div>
        </div>
      </>
    );
  }

  const [totalTasks, completedTasks, overdueTasks, inProgressTasks] = await Promise.all([
    prisma.task.count({ where: { projectId: { in: projectIds }, status: { not: 'ARCHIVED' } } }),
    prisma.task.count({ where: { projectId: { in: projectIds }, status: 'DONE' } }),
    prisma.task.count({
      where: { projectId: { in: projectIds }, dueDate: { lt: now }, status: { notIn: ['DONE', 'ARCHIVED'] } },
    }),
    prisma.task.count({ where: { projectId: { in: projectIds }, status: 'IN_PROGRESS' } }),
  ]);

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
      <Header title={group.name} workspaceSlug={params.workspaceSlug} />
      <div className="flex-1 overflow-auto bg-g-surface p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="全タスク" value={totalTasks} icon={ListTodo} iconColor="text-blue-600" iconBg="bg-blue-50" />
            <StatCard title="完了タスク" value={completedTasks} subtitle={`完了率 ${completionRate}%`} icon={CheckCircle} iconColor="text-green-600" iconBg="bg-green-50" />
            <StatCard title="進行中タスク" value={inProgressTasks} icon={Clock} iconColor="text-yellow-600" iconBg="bg-yellow-50" />
            <StatCard title="期限超過タスク" value={overdueTasks} icon={AlertCircle} iconColor="text-red-600" iconBg="bg-red-50" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ProjectProgress data={byProject} />
            <UpcomingDeadlines data={upcomingDeadlines} workspaceSlug={params.workspaceSlug} />
          </div>
        </div>
      </div>
    </>
  );
}
