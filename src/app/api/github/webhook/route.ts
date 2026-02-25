import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const event = req.headers.get('x-github-event');
    const signature = req.headers.get('x-hub-signature-256');
    const rawBody = await req.text();

    if (event !== 'issues') {
      return successResponse({ ignored: true });
    }

    const payload = JSON.parse(rawBody);
    const { action, issue, repository } = payload;

    if (!issue || !repository) {
      return errorResponse('Invalid payload', 400);
    }

    // リポジトリのマッピングを取得してwebhookSecretで署名検証
    // 現時点ではwebhookSecret未実装のため、node_idベースでタスクを検索
    const task = await prisma.task.findFirst({
      where: { githubIssueNodeId: issue.node_id },
    });
    if (!task) {
      return successResponse({ ignored: true, reason: 'no matching task' });
    }

    // ループ防止: Tasukeが最後に更新し、5秒以内ならスキップ
    if (
      task.githubSyncSource === 'tasuke' &&
      task.githubIssueSyncedAt &&
      Date.now() - task.githubIssueSyncedAt.getTime() < 5000
    ) {
      return successResponse({ ignored: true, reason: 'loop prevention' });
    }

    // 状態マッピング
    let newStatus: string | null = null;
    if (action === 'closed' && task.status !== 'DONE') {
      newStatus = 'DONE';
    } else if (action === 'reopened' && task.status === 'DONE') {
      newStatus = 'TODO';
    }

    if (!newStatus) {
      return successResponse({ ignored: true, reason: 'no status change needed' });
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: newStatus as 'TODO' | 'DONE',
        completedAt: newStatus === 'DONE' ? new Date() : null,
        githubIssueSyncedAt: new Date(),
        githubSyncSource: 'github',
      },
    });

    return successResponse({ updated: true, taskId: task.id, newStatus });
  } catch (error) {
    console.error('[github-webhook] エラー:', error);
    return errorResponse('Webhook processing failed', 500);
  }
}
