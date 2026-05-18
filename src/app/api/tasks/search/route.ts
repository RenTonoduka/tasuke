import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import type { TaskStatus, Priority } from '@prisma/client';

const VALID_STATUS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED'];
const VALID_PRIORITY: Priority[] = ['P0', 'P1', 'P2', 'P3'];

function isValidDate(s: string): boolean {
  const t = Date.parse(s);
  return !Number.isNaN(t);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const workspaceSlug = searchParams.get('workspaceSlug');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assigneeId = searchParams.get('assigneeId');
    const dueBefore = searchParams.get('dueBefore');
    const dueAfter = searchParams.get('dueAfter');

    if (!q || q.length < 2) return successResponse([]);
    if (!workspaceSlug) return errorResponse('workspaceSlug is required', 400);

    const where: Record<string, unknown> = {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
      project: {
        workspace: {
          slug: workspaceSlug,
          members: { some: { userId: user.id } },
        },
      },
    };

    if (status) {
      const statuses = status.split(',').map((s) => s.trim()).filter((s): s is TaskStatus =>
        (VALID_STATUS as string[]).includes(s),
      );
      if (statuses.length === 0) return errorResponse('status の値が不正です', 400);
      where.status = { in: statuses };
    }
    if (priority) {
      const priorities = priority.split(',').map((s) => s.trim()).filter((s): s is Priority =>
        (VALID_PRIORITY as string[]).includes(s),
      );
      if (priorities.length === 0) return errorResponse('priority の値が不正です', 400);
      where.priority = { in: priorities };
    }
    if (assigneeId) {
      where.assignees = { some: { userId: assigneeId } };
    }
    if (dueBefore || dueAfter) {
      if (dueBefore && !isValidDate(dueBefore)) return errorResponse('dueBefore の値が不正です', 400);
      if (dueAfter && !isValidDate(dueAfter)) return errorResponse('dueAfter の値が不正です', 400);
      const dueDateFilter: Record<string, Date> = {};
      if (dueBefore) dueDateFilter.lte = new Date(dueBefore);
      if (dueAfter) dueDateFilter.gte = new Date(dueAfter);
      where.dueDate = dueDateFilter;
    }

    const tasks = await prisma.task.findMany({
      where,
      take: 20,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true, color: true } },
        assignees: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
      },
    });

    return successResponse(tasks);
  } catch (error) {
    return handleApiError(error);
  }
}
