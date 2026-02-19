import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import prisma from '@/lib/prisma';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  // ユーザーのワークスペースとプロジェクト取得
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: {
      workspace: {
        include: {
          projects: {
            orderBy: { position: 'asc' },
            select: { id: true, name: true, color: true },
          },
        },
      },
    },
  });

  const workspace = membership?.workspace;

  return (
    <AppShell
      projects={workspace?.projects ?? []}
      workspaceName={workspace?.name ?? 'ワークスペース'}
      currentWorkspaceSlug={workspace?.slug ?? ''}
    >
      {children}
    </AppShell>
  );
}
