import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { moveTaskSchema } from '@/lib/validations/task';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { logActivity } from '@/lib/activity';
import type { TaskStatus } from '@prisma/client';

const SECTION_STATUS_MAP: Record<string, TaskStatus> = {
  'todo': 'TODO',
  'Todo': 'TODO',
  'TODO': 'TODO',
  'やること': 'TODO',
  '未着手': 'TODO',
  '進行中': 'IN_PROGRESS',
  'In Progress': 'IN_PROGRESS',
  '対応中': 'IN_PROGRESS',
  '完了': 'DONE',
  'Done': 'DONE',
  'done': 'DONE',
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const data = moveTaskSchema.parse(body);

    const existing = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
      include: { project: { select: { workspaceId: true } } },
    });
    if (!existing) return errorResponse('タスクが見つかりません', 404);
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: existing.project.workspaceId, userId: user.id },
    });
    if (member?.role === 'VIEWER') return errorResponse('閲覧者はタスクを移動できません', 403);

    // セクション名からステータスを自動判定
    const updateData: { sectionId: string | null; position: number; status?: TaskStatus; completedAt?: Date | null } = {
      sectionId: data.sectionId,
      position: data.position,
    };

    if (data.sectionId) {
      const targetSection = await prisma.section.findUnique({
        where: { id: data.sectionId },
        select: { name: true },
      });
      if (targetSection) {
        const mappedStatus = SECTION_STATUS_MAP[targetSection.name];
        if (mappedStatus) {
          updateData.status = mappedStatus;
          updateData.completedAt = mappedStatus === 'DONE' ? new Date() : null;
        }
      }
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
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
