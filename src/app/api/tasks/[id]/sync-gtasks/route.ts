import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGoogleClient, getTasksClient } from '@/lib/google';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

type RouteContext = { params: { id: string } };

async function getTaskWithMemberCheck(taskId: string, userId: string) {
  return prisma.task.findFirst({
    where: {
      id: taskId,
      project: { workspace: { members: { some: { userId } } } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      dueDate: true,
      googleTaskId: true,
    },
  });
}

function buildGTaskBody(task: {
  title: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
}) {
  return {
    title: task.title,
    notes: task.description ?? undefined,
    status: task.status === 'DONE' ? 'completed' : 'needsAction',
    due: task.dueDate ? task.dueDate.toISOString() : undefined,
  };
}

// POST: Googleタスクに同期
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuthUser();

    const task = await getTaskWithMemberCheck(params.id, user.id);
    if (!task) return errorResponse('タスクが見つかりません', 404);

    let auth;
    try {
      auth = await getGoogleClient(user.id);
    } catch {
      return errorResponse('Googleアカウントが連携されていません', 400);
    }

    const tasksClient = getTasksClient(auth);
    const requestBody = buildGTaskBody(task);

    let googleTaskId: string;

    if (task.googleTaskId) {
      // 既存タスクを更新
      try {
        const res = await tasksClient.tasks.patch({
          tasklist: '@default',
          task: task.googleTaskId,
          requestBody,
        });
        googleTaskId = res.data.id!;
      } catch (err: unknown) {
        const apiErr = err as { code?: number };
        if (apiErr?.code === 404) {
          // Googleタスク側で削除済み → 新規作成
          const res = await tasksClient.tasks.insert({
            tasklist: '@default',
            requestBody,
          });
          googleTaskId = res.data.id!;
        } else {
          console.error('Google Tasks patch error:', err);
          return errorResponse('Googleタスクの更新に失敗しました', 502);
        }
      }
    } else {
      // 新規作成
      try {
        const res = await tasksClient.tasks.insert({
          tasklist: '@default',
          requestBody,
        });
        googleTaskId = res.data.id!;
      } catch (err) {
        console.error('Google Tasks insert error:', err);
        return errorResponse('Googleタスクの作成に失敗しました', 502);
      }
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        googleTaskId,
        googleSyncedAt: new Date(),
      },
      select: {
        id: true,
        googleTaskId: true,
        googleSyncedAt: true,
      },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE: Googleタスクとの連携を解除
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuthUser();

    const task = await getTaskWithMemberCheck(params.id, user.id);
    if (!task) return errorResponse('タスクが見つかりません', 404);

    if (task.googleTaskId) {
      let auth;
      try {
        auth = await getGoogleClient(user.id);
      } catch {
        return errorResponse('Googleアカウントが連携されていません', 400);
      }

      const tasksClient = getTasksClient(auth);
      try {
        await tasksClient.tasks.delete({
          tasklist: '@default',
          task: task.googleTaskId,
        });
      } catch (err: unknown) {
        const apiErr = err as { code?: number };
        // 404は既に削除済みなので無視
        if (apiErr?.code !== 404) {
          console.error('Google Tasks delete error:', err);
          return errorResponse('Googleタスクの削除に失敗しました', 502);
        }
      }
    }

    await prisma.task.update({
      where: { id: params.id },
      data: {
        googleTaskId: null,
        googleSyncedAt: null,
      },
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
