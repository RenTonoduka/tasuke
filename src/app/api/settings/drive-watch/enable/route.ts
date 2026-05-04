import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { registerDriveWatch } from '@/lib/meeting/drive-watch';
import { assertWorkspaceAccess } from '@/lib/meeting/access';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return errorResponse('workspaceIdが必要です');
    await assertWorkspaceAccess(user.id, workspaceId);

    const channel = await registerDriveWatch({ userId: user.id, workspaceId });

    return successResponse({
      enabled: true,
      expiration: channel.expiration,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
