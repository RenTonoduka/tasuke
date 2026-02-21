import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const user = await requireAuthUser();
    const comment = await prisma.comment.findFirst({
      where: {
        id: params.commentId,
        taskId: params.id,
      },
    });
    if (!comment) return errorResponse('コメントが見つかりません', 404);
    if (comment.userId !== user.id) return errorResponse('自分のコメントのみ編集できます', 403);

    const { content } = await req.json();
    const trimmed = (content ?? '').trim();
    if (!trimmed) return errorResponse('コメント内容が必要です', 400);

    const updated = await prisma.comment.update({
      where: { id: params.commentId },
      data: { content: trimmed },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const user = await requireAuthUser();
    const comment = await prisma.comment.findFirst({
      where: {
        id: params.commentId,
        taskId: params.id,
      },
      include: {
        task: { include: { project: { select: { workspaceId: true } } } },
      },
    });
    if (!comment) return errorResponse('コメントが見つかりません', 404);

    // コメント所有者 or OWNER/ADMINが削除可能
    if (comment.userId !== user.id) {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: comment.task.project.workspaceId,
          userId: user.id,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
      if (!membership) return errorResponse('削除権限がありません', 403);
    }

    await prisma.comment.delete({ where: { id: params.commentId } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
