import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { MyTasksClient } from './client';

export default async function MyTasksPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: { where: { userId: session.user.id } },
    },
  });

  if (!workspace || workspace.members.length === 0) redirect('/');

  const tasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId: session.user.id } },
      project: { workspaceId: workspace.id },
      status: { not: 'ARCHIVED' },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      project: { select: { id: true, name: true, color: true } },
      assignees: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      labels: { include: { label: true } },
      _count: { select: { subtasks: true } },
    },
  });

  const serialized = JSON.parse(JSON.stringify(tasks));

  return (
    <>
      <Header title="マイタスク" workspaceSlug={params.workspaceSlug} />
      <MyTasksClient tasks={serialized} workspaceSlug={params.workspaceSlug} />
    </>
  );
}
