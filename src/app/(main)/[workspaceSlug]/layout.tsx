import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import prisma from '@/lib/prisma';
import { getAccessibleProjects } from '@/lib/project-access';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string };
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
  });
  if (!workspace) redirect('/');

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId: session.user.id },
  });
  if (!membership) redirect('/');

  const projects = await getAccessibleProjects(session.user.id, workspace.id);

  return (
    <AppShell
      projects={projects}
      workspaceName={workspace.name}
      currentWorkspaceSlug={workspace.slug}
      workspaceId={workspace.id}
    >
      {children}
    </AppShell>
  );
}
