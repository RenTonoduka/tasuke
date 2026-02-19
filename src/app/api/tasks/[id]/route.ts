import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateTaskSchema } from '@/lib/validations/task';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
        labels: { include: { label: true } },
        subtasks: {
          orderBy: { position: 'asc' },
          include: {
            assignees: {
              include: { user: { select: { id: true, name: true, image: true } } },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        section: true,
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });

    if (!task) return errorResponse('タスクが見つかりません', 404);
    return successResponse(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();
    const body = await req.json();
    const data = updateTaskSchema.parse(body);

    const updateData: Record<string, unknown> = { ...data };
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    if (data.status === 'DONE') {
      updateData.completedAt = new Date();
    } else if (data.status && data.status !== 'DONE') {
      updateData.completedAt = null;
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        labels: { include: { label: true } },
        _count: { select: { subtasks: true } },
      },
    });

    return successResponse(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();
    await prisma.task.delete({ where: { id: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
