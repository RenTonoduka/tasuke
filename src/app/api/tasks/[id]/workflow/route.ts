import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import {
  WorkflowError,
  requestTask,
  acceptTask,
  declineTask,
  submitTask,
  approveTask,
  sendBackTask,
  cancelRequest,
} from '@/lib/task-workflow';

/**
 * POST /api/tasks/[id]/workflow
 * body: { action, assigneeId?, dueDate?, comment? }
 * action: request | accept | decline | submit | approve | send_back | cancel
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const action = body.action as string;
    const taskId = params.id;

    let result;
    switch (action) {
      case 'request':
        if (!body.assigneeId) return errorResponse('assigneeId は必須です', 400);
        result = await requestTask(user.id, taskId, {
          assigneeId: body.assigneeId,
          dueDate: body.dueDate ?? undefined,
          comment: body.comment ?? undefined,
        });
        break;
      case 'accept':
        result = await acceptTask(user.id, taskId);
        break;
      case 'decline':
        result = await declineTask(user.id, taskId, body.comment ?? '');
        break;
      case 'submit':
        result = await submitTask(user.id, taskId);
        break;
      case 'approve':
        result = await approveTask(user.id, taskId);
        break;
      case 'send_back':
        result = await sendBackTask(user.id, taskId, body.comment ?? '');
        break;
      case 'cancel':
        result = await cancelRequest(user.id, taskId);
        break;
      default:
        return errorResponse(`不明な action: ${action}`, 400);
    }
    return successResponse(result);
  } catch (error) {
    if (error instanceof WorkflowError) return errorResponse(error.message, error.status);
    return handleApiError(error);
  }
}
