import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const user = await requireAuthUser();

    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: {
          workspace: {
            members: { some: { userId: user.id, role: { not: 'VIEWER' } } },
          },
        },
      },
    });
    if (!task) return errorResponse('タスクが見つかりません', 404);

    const attachment = await prisma.taskAttachment.findFirst({
      where: { id: params.attachmentId, taskId: params.id },
    });
    if (!attachment) return errorResponse('添付ファイルが見つかりません', 404);

    if (attachment.userId !== user.id) {
      return errorResponse('この添付ファイルを削除する権限がありません', 403);
    }

    await prisma.taskAttachment.delete({ where: { id: params.attachmentId } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
