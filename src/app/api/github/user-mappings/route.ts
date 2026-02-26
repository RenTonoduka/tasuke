import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const createSchema = z.object({
  workspaceId: z.string().min(1),
  githubLogin: z.string().min(1),
  userId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuthUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return errorResponse('workspaceId is required', 400);

    const mappings = await prisma.gitHubUserMapping.findMany({
      where: { workspaceId },
    });

    // ユーザー情報を付与
    const userIds = mappings.map((m) => m.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const result = mappings.map((m) => ({
      ...m,
      user: userMap.get(m.userId) ?? null,
    }));

    return successResponse({ mappings: result });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { workspaceId, githubLogin, userId } = createSchema.parse(await req.json());

    // ワークスペースメンバー確認
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    });
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return errorResponse('管理者権限が必要です', 403);
    }

    // 対象ユーザーがワークスペースメンバーか確認
    const targetMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!targetMember) return errorResponse('指定されたユーザーはワークスペースメンバーではありません', 400);

    const mapping = await prisma.gitHubUserMapping.upsert({
      where: { workspaceId_githubLogin: { workspaceId, githubLogin } },
      update: { userId },
      create: { workspaceId, githubLogin, userId },
    });

    return successResponse(mapping);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return errorResponse('id is required', 400);

    const mapping = await prisma.gitHubUserMapping.findUnique({ where: { id } });
    if (!mapping) return errorResponse('マッピングが見つかりません', 404);

    // 管理者確認
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: mapping.workspaceId, userId: user.id },
    });
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return errorResponse('管理者権限が必要です', 403);
    }

    await prisma.gitHubUserMapping.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
