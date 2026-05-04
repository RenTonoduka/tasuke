import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { MeetingDetailClient } from './client';

export default async function MeetingDetailPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: { members: { where: { userId: session.user.id } } },
  });
  if (!workspace || workspace.members.length === 0) redirect('/');

  return (
    <>
      <Header title="議事録レビュー" workspaceSlug={params.workspaceSlug} />
      <MeetingDetailClient meetingId={params.id} workspaceSlug={params.workspaceSlug} />
    </>
  );
}
