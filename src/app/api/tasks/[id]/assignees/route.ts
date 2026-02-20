import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const assigneesSchema = z.object({
  userIds: z.array(z.string()),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
      include: { assignees: true },
    });
    if (!task) return errorResponse('タスクが見つかりません', 404);

    const { userIds } = assigneesSchema.parse(await req.json());

    const currentIds = task.assignees.map((a) => a.userId);
    const toAdd = userIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !userIds.includes(id));

    await prisma.$transaction([
      ...toRemove.map((userId) =>
        prisma.taskAssignment.deleteMany({
          where: { taskId: params.id, userId },
        })
      ),
      ...toAdd.map((userId) =>
        prisma.taskAssignment.create({
          data: { taskId: params.id, userId },
        })
      ),
    ]);

    const updated = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
      },
    });

    return successResponse(updated?.assignees ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}
