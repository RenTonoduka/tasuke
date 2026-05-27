import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { listPending } from '@/lib/task-workflow';
import { ApprovalsClient } from './client';

export default async function ApprovalsPage({
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

  const pending = await listPending(session.user.id, workspace.id);
  const initial = JSON.parse(JSON.stringify(pending));

  return (
    <>
      <Header title="承認待ち" workspaceSlug={params.workspaceSlug} />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          <ApprovalsClient
            initial={initial}
            workspaceId={workspace.id}
            workspaceSlug={params.workspaceSlug}
          />
        </div>
      </div>
    </>
  );
}
