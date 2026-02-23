import { randomBytes, createHash } from 'crypto';
import prisma from './prisma';

const TOKEN_PREFIX = 'tsk_';

export function generateApiToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface TokenContext {
  userId: string;
  workspaceId: string;
  scope: string;
}

export async function validateApiToken(bearerToken: string): Promise<TokenContext | null> {
  const hash = hashToken(bearerToken);

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
  });

  if (!token) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt < new Date()) return null;

  // lastUsedAt を非同期で更新（レスポンスをブロックしない）
  prisma.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    userId: token.userId,
    workspaceId: token.workspaceId,
    scope: token.scope,
  };
}
