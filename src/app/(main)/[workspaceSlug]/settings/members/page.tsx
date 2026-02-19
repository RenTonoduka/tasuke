import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { MembersClient } from './client';

export default async function MembersPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: {
        where: { userId: session.user.id },
      },
    },
  });

  if (!workspace || workspace.members.length === 0) redirect('/');

  const myRole = workspace.members[0].role;

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });

  const serialized = JSON.parse(JSON.stringify(members));

  return (
    <>
      <Header title="メンバー管理" />
      <MembersClient
        members={serialized}
        workspaceId={workspace.id}
        myRole={myRole}
        currentUserId={session.user.id}
      />
    </>
  );
}
