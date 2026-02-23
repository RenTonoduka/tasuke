import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateApiToken, hashToken } from '@/lib/api-token';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  scope: z.enum(['read_only', 'read_write']).default('read_write'),
  workspaceId: z.string(),
  expiresInDays: z.number().min(1).max(365).optional(),
});

// トークン一覧
export async function GET() {
  try {
    const user = await requireAuthUser();

    const tokens = await prisma.apiToken.findMany({
      where: { userId: user.id, revokedAt: null },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        scope: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        workspace: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(tokens);
  } catch (error) {
    return handleApiError(error);
  }
}

// トークン発行
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = createSchema.parse(await req.json());

    // ワークスペースメンバーであることを確認
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: body.workspaceId, userId: user.id },
    });
    if (!member) return errorResponse('ワークスペースへのアクセス権がありません', 403);

    const rawToken = generateApiToken();
    const tokenHash = hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 12) + '...';

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const token = await prisma.apiToken.create({
      data: {
        name: body.name,
        tokenHash,
        tokenPrefix,
        scope: body.scope,
        userId: user.id,
        workspaceId: body.workspaceId,
        expiresAt,
      },
    });

    // 生トークンはこの1回だけ返す
    return successResponse({
      id: token.id,
      name: token.name,
      token: rawToken,
      tokenPrefix,
      scope: token.scope,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// トークン無効化
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { tokenId } = await req.json();

    if (!tokenId) return errorResponse('tokenIdが必要です', 400);

    const token = await prisma.apiToken.findFirst({
      where: { id: tokenId, userId: user.id },
    });
    if (!token) return errorResponse('トークンが見つかりません', 404);

    await prisma.apiToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
