import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateTaskSchema } from '@/lib/validations/task';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { logActivity } from '@/lib/activity';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
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
        attachments: {
          orderBy: { createdAt: 'desc' },
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
    const user = await requireAuthUser();
    const body = await req.json();
    const data = updateTaskSchema.parse(body);

    const existing = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
    });
    if (!existing) return errorResponse('タスクが見つかりません', 404);

    const updateData: Record<string, unknown> = { ...data };
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    const statusValue = data.status as string | undefined;
    if (statusValue === 'DONE') {
      updateData.completedAt = new Date();
    } else if (statusValue) {
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

    // アクティビティログ
    if (statusValue === 'DONE') {
      await logActivity({ type: 'TASK_COMPLETED', userId: user.id, taskId: params.id });
    } else if (statusValue && statusValue !== 'DONE') {
      await logActivity({ type: 'TASK_REOPENED', userId: user.id, taskId: params.id });
    } else if (data.priority !== undefined) {
      await logActivity({
        type: 'PRIORITY_CHANGED',
        userId: user.id,
        taskId: params.id,
        metadata: { to: data.priority },
      });
    } else if (data.dueDate !== undefined) {
      await logActivity({ type: 'DUE_DATE_CHANGED', userId: user.id, taskId: params.id });
    } else {
      await logActivity({ type: 'TASK_UPDATED', userId: user.id, taskId: params.id });
    }

    return successResponse(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const existing = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
    });
    if (!existing) return errorResponse('タスクが見つかりません', 404);
    await prisma.task.delete({ where: { id: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
