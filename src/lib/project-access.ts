import prisma from '@/lib/prisma';

/**
 * ユーザーがプロジェクトにアクセスできるかチェック
 * 公開プロジェクト: ワークスペースメンバーならOK
 * 非公開プロジェクト: OWNER/ADMIN or ProjectMemberのみ
 */
export async function canAccessProject(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { isPrivate: true, workspaceId: true },
  });
  if (!project) return false;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: project.workspaceId, userId },
  });
  if (!membership) return false;

  // 公開プロジェクトはワークスペースメンバー全員OK
  if (!project.isPrivate) return true;

  // OWNER/ADMINは常にアクセス可
  if (membership.role === 'OWNER' || membership.role === 'ADMIN') return true;

  // ProjectMemberかチェック
  const pm = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return !!pm;
}

/**
 * ユーザーがアクセス可能なプロジェクトIDリストを取得
 */
export async function getAccessibleProjectIds(userId: string, workspaceId: string): Promise<string[]> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!membership) return [];

  const isAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN';

  if (isAdmin) {
    // OWNER/ADMINは全プロジェクト
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    return projects.map((p) => p.id);
  }

  // 公開プロジェクト + 自分がProjectMemberの非公開プロジェクト
  const projects = await prisma.project.findMany({
    where: {
      workspaceId,
      OR: [
        { isPrivate: false },
        { isPrivate: true, members: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

/**
 * アクセス可能なプロジェクト一覧を取得（サイドバー・API用）
 */
export async function getAccessibleProjects(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!membership) return [];

  const isAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN';

  const where = isAdmin
    ? { workspaceId }
    : {
        workspaceId,
        OR: [
          { isPrivate: false },
          { isPrivate: true, members: { some: { userId } } },
        ],
      };

  return prisma.project.findMany({
    where,
    orderBy: { position: 'asc' },
    select: { id: true, name: true, color: true, isPrivate: true },
  });
}
