import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import type { Priority } from '@prisma/client';

const bulkSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['status', 'priority', 'delete']),
  value: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const { taskIds, action, value } = bulkSchema.parse(body);

    // Verify all tasks belong to workspaces the user is a member of
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
      select: { id: true, project: { select: { workspaceId: true } } },
    });

    if (tasks.length === 0) {
      return errorResponse('対象タスクが見つかりません', 404);
    }

    // Check VIEWER role
    const workspaceIds = Array.from(new Set(tasks.map((t) => t.project.workspaceId)));
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id, workspaceId: { in: workspaceIds } },
    });
    if (memberships.some((m) => m.role === 'VIEWER')) {
      return errorResponse('閲覧者はタスクを編集できません', 403);
    }

    const validIds = tasks.map((t) => t.id);

    switch (action) {
      case 'status': {
        if (!value) return errorResponse('ステータスを指定してください', 400);
        const updateData: Record<string, unknown> = { status: value };
        if (value === 'DONE') updateData.completedAt = new Date();
        else updateData.completedAt = null;
        await prisma.task.updateMany({
          where: { id: { in: validIds } },
          data: updateData,
        });
        return successResponse({ updated: validIds.length });
      }
      case 'priority': {
        if (!value) return errorResponse('優先度を指定してください', 400);
        await prisma.task.updateMany({
          where: { id: { in: validIds } },
          data: { priority: value as Priority },
        });
        return successResponse({ updated: validIds.length });
      }
      case 'delete': {
        await prisma.task.deleteMany({
          where: { id: { in: validIds } },
        });
        return successResponse({ deleted: validIds.length });
      }
      default:
        return errorResponse('不明なアクションです', 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
