import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { ProjectsSettingsClient } from './client';

export default async function ProjectsSettingsPage({
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
  if (myRole !== 'OWNER' && myRole !== 'ADMIN') redirect(`/${params.workspaceSlug}`);

  const projects = await prisma.project.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { position: 'asc' },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  const wsMembers = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });

  const serialized = JSON.parse(JSON.stringify({ projects, wsMembers }));

  return (
    <>
      <Header title="プロジェクト管理" workspaceSlug={params.workspaceSlug} />
      <ProjectsSettingsClient
        projects={serialized.projects}
        workspaceMembers={serialized.wsMembers}
        workspaceId={workspace.id}
      />
    </>
  );
}
