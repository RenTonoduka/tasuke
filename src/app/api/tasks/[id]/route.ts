import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateTaskSchema } from '@/lib/validations/task';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { logActivity } from '@/lib/activity';
import { executeAutomationRules } from '@/lib/automation';
import { getGoogleClient, getCalendarClient } from '@/lib/google';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
        labels: { include: { label: true } },
        subtasks: {
          orderBy: { position: 'asc' },
          include: {
            assignees: {
              include: { user: { select: { id: true, name: true, image: true } } },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        section: true,
        project: { select: { workspaceId: true } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });

    if (!task) return errorResponse('タスクが見つかりません', 404);
    return successResponse(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const data = updateTaskSchema.parse(body);

    // 修正2: project.workspaceId を取得してVIEWERチェックに使う
    const existing = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
      include: { project: { select: { workspaceId: true } } },
    });
    if (!existing) return errorResponse('タスクが見つかりません', 404);

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: existing.project.workspaceId, userId: user.id },
    });
    if (member?.role === 'VIEWER') return errorResponse('閲覧者はタスクを編集できません', 403);

    const oldStatus = existing.status;
    const oldPriority = existing.priority;
    const updateData: Record<string, unknown> = { ...data };
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    const statusValue = data.status as string | undefined;
    if (statusValue === 'DONE') {
      updateData.completedAt = new Date();
    } else if (statusValue) {
      updateData.completedAt = null;
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        labels: { include: { label: true } },
        _count: { select: { subtasks: true } },
      },
    });

    // アクティビティログ
    if (statusValue === 'DONE') {
      await logActivity({ type: 'TASK_COMPLETED', userId: user.id, taskId: params.id });
    } else if (statusValue && statusValue !== 'DONE') {
      await logActivity({ type: 'TASK_REOPENED', userId: user.id, taskId: params.id });
    } else if (data.priority !== undefined) {
      await logActivity({
        type: 'PRIORITY_CHANGED',
        userId: user.id,
        taskId: params.id,
        metadata: { to: data.priority },
      });
    } else if (data.dueDate !== undefined) {
      await logActivity({ type: 'DUE_DATE_CHANGED', userId: user.id, taskId: params.id });
    } else {
      await logActivity({ type: 'TASK_UPDATED', userId: user.id, taskId: params.id });
    }

    // 自動化ルール実行（バックグラウンド・ノンブロッキング）
    if (data.status && data.status !== oldStatus) {
      executeAutomationRules(existing.projectId, 'STATUS_CHANGE', {
        taskId: params.id,
        field: 'status',
        oldValue: oldStatus,
        newValue: data.status,
        userId: user.id,
      }).catch((e) => console.error('[automation] STATUS_CHANGE エラー:', e));
    }
    if (data.priority && data.priority !== oldPriority) {
      executeAutomationRules(existing.projectId, 'PRIORITY_CHANGE', {
        taskId: params.id,
        field: 'priority',
        oldValue: oldPriority,
        newValue: data.priority,
        userId: user.id,
      }).catch((e) => console.error('[automation] PRIORITY_CHANGE エラー:', e));
    }

    return successResponse(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    // 修正2: project.workspaceId を取得してVIEWERチェックに使う
    const existing = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
      include: { project: { select: { workspaceId: true } } },
    });
    if (!existing) return errorResponse('タスクが見つかりません', 404);

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: existing.project.workspaceId, userId: user.id },
    });
    if (member?.role === 'VIEWER') return errorResponse('閲覧者はタスクを削除できません', 403);

    // ScheduleBlock に紐づくGoogleカレンダーイベントを削除
    const scheduleBlocks = await prisma.scheduleBlock.findMany({
      where: { taskId: params.id },
      select: { googleCalendarEventId: true },
    });
    if (scheduleBlocks.length > 0) {
      try {
        const auth = await getGoogleClient(user.id);
        const calendar = getCalendarClient(auth);
        await Promise.allSettled(
          scheduleBlocks.map((b) =>
            calendar.events.delete({ calendarId: 'primary', eventId: b.googleCalendarEventId }).catch(() => {}),
          ),
        );
      } catch {
        // Google認証エラーでもタスク削除は続行
      }
    }

    await prisma.task.delete({ where: { id: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
