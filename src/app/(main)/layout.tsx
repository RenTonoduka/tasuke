import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import prisma from '@/lib/prisma';
import { getAccessibleProjects } from '@/lib/project-access';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
  });

  const workspace = membership?.workspace;
  const projects = workspace
    ? await getAccessibleProjects(session.user.id, workspace.id)
    : [];

  return (
    <AppShell
      projects={projects}
      workspaceName={workspace?.name ?? 'ワークスペース'}
      currentWorkspaceSlug={workspace?.slug ?? ''}
      workspaceId={workspace?.id ?? ''}
    >
      {children}
    </AppShell>
  );
}
