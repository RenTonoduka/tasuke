import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { successResponse, handleApiError, errorResponse } from '@/lib/api-utils';
import { extractMeetingSchema } from '@/lib/validations/meeting';
import { extractMeeting } from '@/lib/meeting/extractor';
import { assertWorkspaceAccess } from '@/lib/meeting/access';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return errorResponse('workspaceIdが必要です');
    await assertWorkspaceAccess(user.id, workspaceId);

    const body = await req.json();
    const data = extractMeetingSchema.parse(body);

    const result = await extractMeeting({
      workspaceId,
      userId: user.id,
      title: data.title,
      transcript: data.transcript,
      meetingDate: data.meetingDate ? new Date(data.meetingDate) : null,
      attendees: data.attendees,
      source: 'MANUAL_PASTE',
    });

    if (result.failed) {
      return errorResponse(`抽出に失敗しました: ${result.failureReason ?? 'unknown'}`, 502);
    }
    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
