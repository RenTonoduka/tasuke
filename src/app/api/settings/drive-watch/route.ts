import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { stopDriveWatch } from '@/lib/meeting/drive-watch';
import { assertWorkspaceAccess } from '@/lib/meeting/access';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return errorResponse('workspaceIdが必要です');
    await assertWorkspaceAccess(user.id, workspaceId);

    const channel = await prisma.driveWatchChannel.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
      select: {
        id: true,
        enabled: true,
        expiration: true,
        lastNotifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return successResponse({ channel });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return errorResponse('workspaceIdが必要です');
    await assertWorkspaceAccess(user.id, workspaceId);

    const result = await stopDriveWatch(user.id, workspaceId);
    return successResponse({ stopped: !!result });
  } catch (error) {
    return handleApiError(error);
  }
}
