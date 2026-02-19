import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) return errorResponse('通知が見つかりません', 404);
    if (notification.userId !== user.id) return errorResponse('権限がありません', 403);

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { read: body.read ?? true },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
