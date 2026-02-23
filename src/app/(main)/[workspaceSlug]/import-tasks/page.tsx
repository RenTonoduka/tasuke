import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { ImportTasksClient } from './client';

export default async function ImportTasksPage({
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
      projects: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          color: true,
          sections: { orderBy: { position: 'asc' }, select: { id: true, name: true } },
        },
      },
    },
  });

  if (!workspace || workspace.members.length === 0) redirect('/');

  return (
    <div className="flex h-screen flex-col">
      <Header title="タスク取り込み" workspaceSlug={params.workspaceSlug} />
      <ImportTasksClient
        workspaceId={workspace.id}
        workspaceSlug={params.workspaceSlug}
        projects={workspace.projects}
      />
    </div>
  );
}
