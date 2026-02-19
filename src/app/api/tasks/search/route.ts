import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const workspaceSlug = searchParams.get('workspaceSlug');

    if (!q || q.length < 2) return successResponse([]);
    if (!workspaceSlug) return errorResponse('workspaceSlug is required', 400);

    const tasks = await prisma.task.findMany({
      where: {
        title: { contains: q, mode: 'insensitive' },
        project: { workspace: { slug: workspaceSlug } },
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        project: { select: { name: true, color: true } },
      },
    });

    return successResponse(tasks);
  } catch (error) {
    return handleApiError(error);
  }
}
