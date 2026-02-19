import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createTaskSchema } from '@/lib/validations/task';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { logActivity } from '@/lib/activity';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();
    const tasks = await prisma.task.findMany({
      where: { projectId: params.id, parentId: null },
      orderBy: { position: 'asc' },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        labels: { include: { label: true } },
        _count: { select: { subtasks: true } },
      },
    });
    return successResponse(tasks);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const { assigneeIds, ...data } = createTaskSchema.parse(body);

    // position計算: セクション内の末尾に追加
    const maxPos = await prisma.task.aggregate({
      where: { projectId: params.id, sectionId: data.sectionId ?? undefined },
      _max: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        projectId: params.id,
        createdById: user.id,
        position: (maxPos._max.position ?? 0) + 1,
        assignees: assigneeIds?.length
          ? { create: assigneeIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        labels: { include: { label: true } },
        _count: { select: { subtasks: true } },
      },
    });

    await logActivity({ type: 'TASK_CREATED', userId: user.id, taskId: task.id });

    return successResponse(task, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
