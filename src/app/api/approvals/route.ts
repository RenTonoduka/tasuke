import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { listPending } from '@/lib/task-workflow';

/**
 * GET /api/approvals?workspaceId=xxx
 * 現在のユーザーの「承認する番(toApprove)」と「受諾/対応する番(toAccept)」を返す。
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const workspaceId = req.nextUrl.searchParams.get('workspaceId') ?? undefined;
    const result = await listPending(user.id, workspaceId);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
