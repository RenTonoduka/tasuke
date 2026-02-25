import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { ImportGitHubClient } from './client';

export default async function ImportGitHubPage({
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
      <Header title="GitHub Issues" workspaceSlug={params.workspaceSlug} />
      <ImportGitHubClient
        workspaceId={workspace.id}
        workspaceSlug={params.workspaceSlug}
        projects={workspace.projects}
      />
    </div>
  );
}
