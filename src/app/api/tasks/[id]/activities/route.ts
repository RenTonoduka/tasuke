import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();

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
