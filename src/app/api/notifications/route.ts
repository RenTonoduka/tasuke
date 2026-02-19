import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
    return successResponse(notifications);
  } catch (error) {
    return handleApiError(error);
  }
}
