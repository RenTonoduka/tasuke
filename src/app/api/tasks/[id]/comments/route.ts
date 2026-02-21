import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { createNotification, extractMentions } from '@/lib/notifications';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
    });
    if (!task) return errorResponse('タスクが見つかりません', 404);
    const comments = await prisma.comment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
    return successResponse(comments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuthUser();
    const body = await req.json();
    const content: string = (body.content ?? '').trim();

    if (!content) {
      return errorResponse('コメント内容が必要です', 400);
    }

    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: currentUser.id } } } },
      },
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!task) return errorResponse('タスクが見つかりません', 404);

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId: params.id,
        userId: currentUser.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // 通知対象を収集（重複排除）
    const notifyUserIds: string[] = [];
    const notifyUserIdSet = new Set<string>();

    const addNotifyUser = (userId: string) => {
      if (!notifyUserIdSet.has(userId)) {
        notifyUserIdSet.add(userId);
        notifyUserIds.push(userId);
      }
    };

    // タスク担当者に通知
    for (const a of task.assignees) {
      if (a.user.id !== currentUser.id) {
        addNotifyUser(a.user.id);
      }
    }

    // タスク作成者に通知
    if (task.createdBy.id !== currentUser.id) {
      addNotifyUser(task.createdBy.id);
    }

    const commenterName = currentUser.name ?? 'ユーザー';

    // 担当者・作成者へのコメント通知
    for (const userId of notifyUserIds) {
      await createNotification({
        userId,
        type: 'COMMENT',
        message: `${commenterName}が「${task.title}」にコメントしました`,
        taskId: task.id,
      });
    }

    // @メンション検出して通知
    const mentions = extractMentions(content);
    if (mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: { name: { in: mentions, not: null } },
        select: { id: true, name: true },
      });

      for (const u of mentionedUsers) {
        if (u.id !== currentUser.id && !notifyUserIdSet.has(u.id)) {
          await createNotification({
            userId: u.id,
            type: 'MENTION',
            message: `${commenterName}が「${task.title}」のコメントであなたをメンションしました`,
            taskId: task.id,
          });
        }
      }
    }

    return successResponse(comment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
