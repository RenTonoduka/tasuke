import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
