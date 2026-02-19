import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { moveTaskSchema } from '@/lib/validations/task';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { logActivity } from '@/lib/activity';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const data = moveTaskSchema.parse(body);

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        sectionId: data.sectionId,
        position: data.position,
      },
    });

    await logActivity({
      type: 'TASK_MOVED',
      userId: user.id,
      taskId: params.id,
      metadata: { sectionId: data.sectionId },
    });

    return successResponse(task);
  } catch (error) {
    return handleApiError(error);
  }
}
