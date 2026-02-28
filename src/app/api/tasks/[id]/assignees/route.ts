import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { syncTaskToGitHub } from '@/lib/github-sync';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';

const assigneesSchema = z.object({
  userIds: z.array(z.string()),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
      include: { assignees: true, project: { select: { workspaceId: true } } },
    });
    if (!task) return errorResponse('タスクが見つかりません', 404);

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: task.project.workspaceId, userId: user.id },
    });
    if (member?.role === 'VIEWER') return errorResponse('閲覧者はアサインを変更できません', 403);

    const { userIds } = assigneesSchema.parse(await req.json());

    // 指定されたユーザーがワークスペースメンバーであることを検証
    if (userIds.length > 0) {
      const validMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: task.project.workspaceId, userId: { in: userIds } },
        select: { userId: true },
      });
      const validIds = new Set(validMembers.map((m) => m.userId));
      const invalid = userIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) return errorResponse('ワークスペースに所属していないユーザーが含まれています', 400);
    }

    const currentIds = task.assignees.map((a) => a.userId);
    const toAdd = userIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !userIds.includes(id));

    await prisma.$transaction([
      ...toRemove.map((userId) =>
        prisma.taskAssignment.deleteMany({
          where: { taskId: params.id, userId },
        })
      ),
      ...toAdd.map((userId) =>
        prisma.taskAssignment.create({
          data: { taskId: params.id, userId },
        })
      ),
    ]);

    const updated = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
      },
    });

    // 新規追加ユーザーに通知（自分自身は除く）
    for (const userId of toAdd) {
      if (userId !== user.id) {
        createNotification({
          userId,
          type: 'ASSIGNED',
          message: `「${task.title}」に割り当てられました`,
          taskId: params.id,
        }).catch((e) => console.error('[notification] assignee通知エラー:', e));
      }
    }

    // GitHub同期（担当者変更）
    if (task.githubIssueId) {
      syncTaskToGitHub(params.id, user.id, { fields: ['assignees'] }).catch((e) =>
        console.error('[github-sync] assignees エラー:', e)
      );
    }

    return successResponse(updated?.assignees ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}
