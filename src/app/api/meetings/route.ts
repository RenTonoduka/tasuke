import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { assertWorkspaceAccess } from '@/lib/meeting/access';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return errorResponse('workspaceIdが必要です');

    await assertWorkspaceAccess(user.id, workspaceId);

    const meetings = await prisma.meeting.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        source: true,
        meetingDate: true,
        createdAt: true,
        approvedAt: true,
        failureReason: true,
        _count: { select: { extractedTasks: true } },
      },
    });

    return successResponse(meetings);
  } catch (error) {
    return handleApiError(error);
  }
}
