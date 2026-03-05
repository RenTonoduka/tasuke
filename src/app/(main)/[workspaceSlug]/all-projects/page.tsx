import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { getAccessibleProjectIds } from '@/lib/project-access';
import { AllProjectsClient } from './client';

export default async function AllProjectsPage({
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

  const accessibleIds = await getAccessibleProjectIds(session.user.id, workspace.id);

  const projects = await prisma.project.findMany({
    where: { id: { in: accessibleIds } },
    select: { id: true, name: true, color: true },
    orderBy: { position: 'asc' },
  });
  const projectIds = projects.map((p) => p.id);

  const tasks = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      status: { not: 'ARCHIVED' },
      parentId: null,
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      projectId: true,
      assignees: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
  });

  const serializedTasks = tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate?.toISOString() ?? null,
    assignees: t.assignees.map((a) => ({ id: a.id, user: a.user })),
  }));

  return (
    <>
      <Header title="All Projects" workspaceSlug={params.workspaceSlug} />
      <AllProjectsClient
        projects={projects}
        tasks={serializedTasks}
        workspaceSlug={params.workspaceSlug}
      />
    </>
  );
}
