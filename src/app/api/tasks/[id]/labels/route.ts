import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const labelsSchema = z.object({
  labelIds: z.array(z.string()),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
      include: { labels: true, project: { select: { workspaceId: true } } },
    });
    if (!task) return errorResponse('タスクが見つかりません', 404);

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: task.project.workspaceId, userId: user.id },
    });
    if (member?.role === 'VIEWER') return errorResponse('閲覧者はラベルを変更できません', 403);

    const { labelIds } = labelsSchema.parse(await req.json());

    const currentIds = task.labels.map((l) => l.labelId);
    const toAdd = labelIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !labelIds.includes(id));

    await prisma.$transaction([
      ...toRemove.map((labelId) =>
        prisma.taskLabel.deleteMany({
          where: { taskId: params.id, labelId },
        })
      ),
      ...toAdd.map((labelId) =>
        prisma.taskLabel.create({
          data: { taskId: params.id, labelId },
        })
      ),
    ]);

    const updated = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        labels: { include: { label: true } },
      },
    });

    return successResponse(updated?.labels ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}
