import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { moveTaskSchema } from '@/lib/validations/task';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();
    const body = await req.json();
    const data = moveTaskSchema.parse(body);

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        sectionId: data.sectionId,
        position: data.position,
      },
    });

    return successResponse(task);
  } catch (error) {
    return handleApiError(error);
  }
}
