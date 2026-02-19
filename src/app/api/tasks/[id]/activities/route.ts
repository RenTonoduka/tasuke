import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
    });
    if (!task) return errorResponse('タスクが見つかりません', 404);

    const activities = await prisma.activity.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return successResponse(activities);
  } catch (error) {
    return handleApiError(error);
  }
}
