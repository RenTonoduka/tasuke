import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGitHubToken, githubApi } from '@/lib/github';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const setupSchema = z.object({
  githubRepoFullName: z.string(),
  workspaceId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { githubRepoFullName, workspaceId } = setupSchema.parse(await req.json());

    // ワークスペースメンバー確認（ADMIN以上）
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    });
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return errorResponse('管理者権限が必要です', 403);
    }

    const mapping = await prisma.gitHubRepoMapping.findFirst({
      where: { workspaceId, githubRepoFullName },
    });
    if (!mapping) {
      return errorResponse('リポジトリマッピングが見つかりません', 404);
    }

    // 既にWebhookが登録済みの場合
    if (mapping.webhookId) {
      return successResponse({ webhookId: mapping.webhookId, alreadyExists: true });
    }

    const token = await getGitHubToken(user.id);
    const secret = randomBytes(32).toString('hex');

    // アプリのベースURLを取得
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      return errorResponse('NEXTAUTH_URLが設定されていません', 500);
    }

    const webhook = await githubApi<{ id: number }>(
      token,
      `/repos/${githubRepoFullName}/hooks`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['issues'],
          config: {
            url: `${baseUrl}/api/github/webhook`,
            content_type: 'json',
            secret,
            insecure_ssl: '0',
          },
        }),
      }
    );

    await prisma.gitHubRepoMapping.update({
      where: { id: mapping.id },
      data: {
        webhookId: webhook.id,
        webhookSecret: secret,
      },
    });

    return successResponse({ webhookId: webhook.id });
  } catch (error) {
    return handleApiError(error);
  }
}

// Webhook削除
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { searchParams } = new URL(req.url);
    const githubRepoFullName = searchParams.get('repo');
    const workspaceId = searchParams.get('workspaceId');

    if (!githubRepoFullName || !workspaceId) {
      return errorResponse('パラメータが不足しています', 400);
    }

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    });
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return errorResponse('管理者権限が必要です', 403);
    }

    const mapping = await prisma.gitHubRepoMapping.findFirst({
      where: { workspaceId, githubRepoFullName },
    });
    if (!mapping?.webhookId) {
      return successResponse({ deleted: true });
    }

    const token = await getGitHubToken(user.id);

    try {
      await githubApi(
        token,
        `/repos/${githubRepoFullName}/hooks/${mapping.webhookId}`,
        { method: 'DELETE' }
      );
    } catch {
      // GitHubからの削除が失敗してもDBはクリアする
    }

    await prisma.gitHubRepoMapping.update({
      where: { id: mapping.id },
      data: { webhookId: null, webhookSecret: null },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
