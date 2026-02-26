import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { GitHubSettingsClient } from './client';

export default async function GitHubSettingsPage({
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

  return (
    <>
      <Header title="GitHub連携" workspaceSlug={params.workspaceSlug} />
      <GitHubSettingsClient workspaceSlug={params.workspaceSlug} workspaceId={workspace.id} />
    </>
  );
}
