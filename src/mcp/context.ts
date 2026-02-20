import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let cachedUserId: string | null = null;
let cachedWorkspaceId: string | null = null;

export async function getDefaultUser() {
  if (cachedUserId) return cachedUserId;
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) throw new Error('ユーザーが存在しません');
  cachedUserId = user.id;
  return user.id;
}

export async function getDefaultWorkspace() {
  if (cachedWorkspaceId) return cachedWorkspaceId;
  const userId = await getDefaultUser();
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
  });
  if (!member) throw new Error('ワークスペースが存在しません');
  cachedWorkspaceId = member.workspaceId;
  return member.workspaceId;
}

export { prisma };
