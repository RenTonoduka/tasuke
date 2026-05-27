import prisma from '@/lib/prisma';
import { canAccessProject } from '@/lib/project-access';
import { createNotification } from '@/lib/notifications';
import { logActivity } from '@/lib/activity';

/**
 * 依頼→承認ワークフローの中核ロジック。
 * API ルート / MCP ハンドラ / CLI がすべてこの関数群を呼ぶ（3層で単一の真実）。
 *
 * 状態遷移:
 *   request: (通常) → PENDING_ACCEPT
 *   accept : PENDING_ACCEPT → IN_PROGRESS
 *   decline: PENDING_ACCEPT → DECLINED            (コメント必須)
 *   submit : IN_PROGRESS|SENT_BACK → SUBMITTED
 *   approve: SUBMITTED → APPROVED (status=DONE)
 *   sendBack: SUBMITTED → SENT_BACK               (コメント必須)
 *   cancel : (APPROVED以外) → null（通常タスクに戻す）
 */

export class WorkflowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// UI へ返す標準 include
export const workflowTaskInclude = {
  assignees: { include: { user: { select: { id: true, name: true, image: true } } } },
  requester: { select: { id: true, name: true, image: true } },
  labels: { include: { label: true } },
  project: { select: { id: true, name: true, color: true } },
  _count: { select: { subtasks: true } },
} as const;

async function loadTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true } } },
  });
  if (!task) throw new WorkflowError('タスクが見つかりません', 404);
  return task;
}

async function userName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name ?? '誰か';
}

function assigneeId(task: { assignees: { userId: string }[] }): string | null {
  return task.assignees[0]?.userId ?? null;
}

async function returnTask(taskId: string) {
  return prisma.task.findUnique({ where: { id: taskId }, include: workflowTaskInclude });
}

/** 依頼する: 担当者を1人指定し受諾待ちにする */
export async function requestTask(
  actorId: string,
  taskId: string,
  opts: { assigneeId: string; dueDate?: string | null; comment?: string | null },
) {
  const task = await loadTask(taskId);
  if (!(await canAccessProject(actorId, task.projectId))) {
    throw new WorkflowError('プロジェクトへのアクセス権がありません', 403);
  }
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: actorId, workspace: { projects: { some: { id: task.projectId } } } },
    select: { role: true },
  });
  if (membership?.role === 'VIEWER') throw new WorkflowError('閲覧者は依頼できません', 403);

  await prisma.$transaction([
    prisma.taskAssignment.deleteMany({ where: { taskId } }),
    prisma.taskAssignment.create({ data: { taskId, userId: opts.assigneeId } }),
    prisma.task.update({
      where: { id: taskId },
      data: {
        requesterId: actorId,
        assignmentState: 'PENDING_ACCEPT',
        ...(opts.dueDate !== undefined ? { dueDate: opts.dueDate ? new Date(opts.dueDate) : null } : {}),
      },
    }),
  ]);

  if (opts.comment) {
    await prisma.comment.create({ data: { taskId, userId: actorId, content: opts.comment } });
  }
  const name = await userName(actorId);
  await createNotification({
    userId: opts.assigneeId,
    type: 'TASK_REQUESTED',
    message: `${name} さんからタスク依頼が届きました: ${task.title}`,
    taskId,
  });
  await logActivity({ type: 'TASK_REQUESTED', userId: actorId, taskId });
  return returnTask(taskId);
}

/** 受諾: PENDING_ACCEPT → IN_PROGRESS */
export async function acceptTask(actorId: string, taskId: string) {
  const task = await loadTask(taskId);
  if (assigneeId(task) !== actorId) throw new WorkflowError('担当者のみ受諾できます', 403);
  if (task.assignmentState !== 'PENDING_ACCEPT') {
    throw new WorkflowError('受諾待ちのタスクではありません', 400);
  }
  await prisma.task.update({
    where: { id: taskId },
    data: { assignmentState: 'IN_PROGRESS', status: 'IN_PROGRESS' },
  });
  const name = await userName(actorId);
  if (task.requesterId) {
    await createNotification({
      userId: task.requesterId,
      type: 'TASK_ACCEPTED',
      message: `${name} さんが依頼を受諾しました: ${task.title}`,
      taskId,
    });
  }
  await logActivity({ type: 'TASK_ACCEPTED', userId: actorId, taskId });
  return returnTask(taskId);
}

/** 辞退: PENDING_ACCEPT → DECLINED（コメント必須） */
export async function declineTask(actorId: string, taskId: string, comment: string) {
  if (!comment?.trim()) throw new WorkflowError('辞退理由（コメント）は必須です', 400);
  const task = await loadTask(taskId);
  if (assigneeId(task) !== actorId) throw new WorkflowError('担当者のみ辞退できます', 403);
  if (task.assignmentState !== 'PENDING_ACCEPT') {
    throw new WorkflowError('受諾待ちのタスクではありません', 400);
  }
  await prisma.task.update({ where: { id: taskId }, data: { assignmentState: 'DECLINED' } });
  await prisma.comment.create({ data: { taskId, userId: actorId, content: `【辞退】${comment}` } });
  const name = await userName(actorId);
  if (task.requesterId) {
    await createNotification({
      userId: task.requesterId,
      type: 'TASK_DECLINED',
      message: `${name} さんが依頼を辞退しました: ${task.title}（理由: ${comment}）`,
      taskId,
    });
  }
  await logActivity({ type: 'TASK_DECLINED', userId: actorId, taskId, metadata: { comment } });
  return returnTask(taskId);
}

/** 完了報告: IN_PROGRESS|SENT_BACK → SUBMITTED */
export async function submitTask(actorId: string, taskId: string) {
  const task = await loadTask(taskId);
  if (assigneeId(task) !== actorId) throw new WorkflowError('担当者のみ完了報告できます', 403);
  if (task.assignmentState !== 'IN_PROGRESS' && task.assignmentState !== 'SENT_BACK') {
    throw new WorkflowError('対応中のタスクではありません', 400);
  }
  await prisma.task.update({ where: { id: taskId }, data: { assignmentState: 'SUBMITTED' } });
  const name = await userName(actorId);
  if (task.requesterId) {
    await createNotification({
      userId: task.requesterId,
      type: 'TASK_SUBMITTED',
      message: `${name} さんが完了報告しました（承認待ち）: ${task.title}`,
      taskId,
    });
  }
  await logActivity({ type: 'TASK_SUBMITTED', userId: actorId, taskId });
  return returnTask(taskId);
}

/** 承認: SUBMITTED → APPROVED（status=DONE） */
export async function approveTask(actorId: string, taskId: string) {
  const task = await loadTask(taskId);
  if (task.requesterId !== actorId) throw new WorkflowError('依頼者のみ承認できます', 403);
  if (task.assignmentState !== 'SUBMITTED') throw new WorkflowError('承認待ちのタスクではありません', 400);
  await prisma.task.update({
    where: { id: taskId },
    data: { assignmentState: 'APPROVED', status: 'DONE', completedAt: new Date() },
  });
  const name = await userName(actorId);
  const target = assigneeId(task);
  if (target) {
    await createNotification({
      userId: target,
      type: 'TASK_APPROVED',
      message: `${name} さんが承認しました🎉: ${task.title}`,
      taskId,
    });
  }
  await logActivity({ type: 'TASK_APPROVED', userId: actorId, taskId });
  return returnTask(taskId);
}

/** 差し戻し: SUBMITTED → SENT_BACK（コメント必須） */
export async function sendBackTask(actorId: string, taskId: string, comment: string) {
  if (!comment?.trim()) throw new WorkflowError('差し戻し理由（コメント）は必須です', 400);
  const task = await loadTask(taskId);
  if (task.requesterId !== actorId) throw new WorkflowError('依頼者のみ差し戻せます', 403);
  if (task.assignmentState !== 'SUBMITTED') throw new WorkflowError('承認待ちのタスクではありません', 400);
  await prisma.task.update({ where: { id: taskId }, data: { assignmentState: 'SENT_BACK' } });
  await prisma.comment.create({ data: { taskId, userId: actorId, content: `【差し戻し】${comment}` } });
  const name = await userName(actorId);
  const target = assigneeId(task);
  if (target) {
    await createNotification({
      userId: target,
      type: 'TASK_SENT_BACK',
      message: `${name} さんが差し戻しました: ${task.title}（理由: ${comment}）`,
      taskId,
    });
  }
  await logActivity({ type: 'TASK_SENT_BACK', userId: actorId, taskId, metadata: { comment } });
  return returnTask(taskId);
}

/** 依頼取り消し: APPROVED以外 → 通常タスクに戻す */
export async function cancelRequest(actorId: string, taskId: string) {
  const task = await loadTask(taskId);
  if (task.requesterId !== actorId) throw new WorkflowError('依頼者のみ取り消せます', 403);
  if (!task.assignmentState) throw new WorkflowError('依頼中のタスクではありません', 400);
  if (task.assignmentState === 'APPROVED') throw new WorkflowError('承認済みは取り消せません', 400);
  await prisma.task.update({
    where: { id: taskId },
    data: { requesterId: null, assignmentState: null },
  });
  const target = assigneeId(task);
  if (target) {
    await createNotification({
      userId: target,
      type: 'REQUEST_CANCELLED',
      message: `依頼が取り消されました: ${task.title}`,
      taskId,
    });
  }
  await logActivity({ type: 'REQUEST_CANCELLED', userId: actorId, taskId });
  return returnTask(taskId);
}

/** 承認する番（依頼者として SUBMITTED）/ 受諾・対応する番（担当者として PENDING_ACCEPT|SENT_BACK） */
export async function listPending(userId: string, workspaceId?: string) {
  const projectFilter = workspaceId ? { project: { workspaceId } } : {};
  const [toApprove, toAccept] = await Promise.all([
    prisma.task.findMany({
      where: { requesterId: userId, assignmentState: 'SUBMITTED', ...projectFilter },
      include: workflowTaskInclude,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.task.findMany({
      where: {
        assignmentState: { in: ['PENDING_ACCEPT', 'SENT_BACK'] },
        assignees: { some: { userId } },
        ...projectFilter,
      },
      include: workflowTaskInclude,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);
  return { toApprove, toAccept };
}
