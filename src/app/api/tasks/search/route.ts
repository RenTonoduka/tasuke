import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

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
      where.status = { in: status.split(',') };
    }
    if (priority) {
      where.priority = { in: priority.split(',') };
    }
    if (assigneeId) {
      where.assignees = { some: { userId: assigneeId } };
    }
    if (dueBefore || dueAfter) {
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
