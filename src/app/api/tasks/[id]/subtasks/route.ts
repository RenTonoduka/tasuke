import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const createSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const parentTask = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
    });
    if (!parentTask) return errorResponse('タスクが見つかりません', 404);
    const subtasks = await prisma.task.findMany({
      where: { parentId: params.id },
      orderBy: { position: 'asc' },
      include: { _count: { select: { subtasks: true } } },
    });
    return successResponse(subtasks);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const data = createSubtaskSchema.parse(body);

    const parentTask = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
      select: { projectId: true, sectionId: true, project: { select: { workspaceId: true } } },
    });

    if (!parentTask) {
      return errorResponse('親タスクが見つかりません', 404);
    }

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: parentTask.project.workspaceId, userId: user.id },
    });
    if (member?.role === 'VIEWER') return errorResponse('閲覧者はサブタスクを作成できません', 403);

    const maxPos = await prisma.task.aggregate({
      where: { parentId: params.id },
      _max: { position: true },
    });

    const subtask = await prisma.task.create({
      data: {
        title: data.title,
        parentId: params.id,
        projectId: parentTask.projectId,
        sectionId: parentTask.sectionId,
        createdById: user.id,
        position: (maxPos._max.position ?? 0) + 1,
      },
    });

    return successResponse(subtask, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
