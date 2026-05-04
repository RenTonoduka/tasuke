import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, handleApiError, errorResponse } from '@/lib/api-utils';
import { patchExtractedTaskSchema } from '@/lib/validations/meeting';
import { assertMeetingAccess } from '@/lib/meeting/access';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; etId: string } },
) {
  try {
    const user = await requireAuthUser();
    await assertMeetingAccess(user.id, params.id);

    const et = await prisma.extractedTask.findUnique({ where: { id: params.etId } });
    if (!et || et.meetingId !== params.id) {
      return errorResponse('抽出タスクが見つかりません', 404);
    }
    if (et.status === 'APPROVED') {
      return errorResponse('既に承認済みのタスクは編集できません', 409);
    }

    const body = await req.json();
    const data = patchExtractedTaskSchema.parse(body);

    const updated = await prisma.extractedTask.update({
      where: { id: params.etId },
      data: {
        finalTitle: data.finalTitle ?? undefined,
        finalDescription: data.finalDescription ?? undefined,
        finalAssigneeId: data.finalAssigneeId ?? undefined,
        finalProjectId: data.finalProjectId ?? undefined,
        finalSectionId: data.finalSectionId ?? undefined,
        finalDueDate: data.finalDueDate ? new Date(data.finalDueDate) : undefined,
        finalPriority: data.finalPriority ?? undefined,
      },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
