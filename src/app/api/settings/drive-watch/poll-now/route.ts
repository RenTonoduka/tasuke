import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { pollChangesForChannel } from '@/lib/meeting/drive-watch';
import { assertWorkspaceAccess } from '@/lib/meeting/access';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return errorResponse('workspaceIdが必要です');
    await assertWorkspaceAccess(user.id, workspaceId);

    const channel = await prisma.driveWatchChannel.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
      select: { id: true, enabled: true },
    });
    if (!channel) return errorResponse('Drive Watchが有効化されていません', 400);
    if (!channel.enabled) return errorResponse('Drive Watchが無効化されています', 400);

    const result = await pollChangesForChannel(channel.id);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
