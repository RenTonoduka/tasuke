import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const event = req.headers.get('x-github-event');
    const signature = req.headers.get('x-hub-signature-256');
    const rawBody = await req.text();

    if (event !== 'issues') {
      return successResponse({ ignored: true });
    }

    const payload = JSON.parse(rawBody);
    const { action, issue, repository } = payload;

    if (!issue || !repository) {
      return errorResponse('Invalid payload', 400);
    }

    const repoFullName = repository.full_name as string;

    // リポジトリマッピングを取得して署名検証
    const mapping = await prisma.gitHubRepoMapping.findFirst({
      where: { githubRepoFullName: repoFullName },
      include: { project: { select: { workspaceId: true } } },
    });

    if (mapping?.webhookSecret) {
      if (!verifySignature(rawBody, signature, mapping.webhookSecret)) {
        return errorResponse('Invalid signature', 401);
      }
    }

    // opened: 新規タスク自動作成
    if (action === 'opened' && mapping) {
      const existingTask = await prisma.task.findFirst({
        where: { githubIssueNodeId: issue.node_id },
      });
      if (!existingTask) {
        await createTaskFromIssue(issue, repoFullName, mapping.projectId, mapping.project.workspaceId, mapping.userId);
        return successResponse({ created: true });
      }
    }

    // 既存タスクを検索
    const task = await prisma.task.findFirst({
      where: { githubIssueNodeId: issue.node_id },
      include: {
        labels: { include: { label: true } },
        assignees: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!task) {
      return successResponse({ ignored: true, reason: 'no matching task' });
    }

    // ループ防止
    if (
      task.githubSyncSource === 'tasuke' &&
      task.githubIssueSyncedAt &&
      Date.now() - task.githubIssueSyncedAt.getTime() < 5000
    ) {
      return successResponse({ ignored: true, reason: 'loop prevention' });
    }

    const workspaceId = task.project.workspaceId;
    const updateData: Record<string, unknown> = {
      githubIssueSyncedAt: new Date(),
      githubSyncSource: 'github',
    };

    switch (action) {
      case 'edited': {
        const changes = payload.changes ?? {};
        if (changes.title) updateData.title = issue.title;
        if (changes.body) updateData.description = issue.body ?? null;
        break;
      }
      case 'closed':
        if (task.status !== 'DONE') {
          updateData.status = 'DONE';
          updateData.completedAt = new Date();
        }
        break;
      case 'reopened':
        if (task.status === 'DONE') {
          updateData.status = 'TODO';
          updateData.completedAt = null;
        }
        break;
      case 'labeled':
      case 'unlabeled': {
        await syncLabelsFromGitHub(task.id, workspaceId, issue.labels ?? []);
        break;
      }
      case 'assigned':
      case 'unassigned': {
        await syncAssigneesFromGitHub(task.id, workspaceId, issue.assignees ?? []);
        break;
      }
      default:
        return successResponse({ ignored: true, reason: `unhandled action: ${action}` });
    }

    await prisma.task.update({
      where: { id: task.id },
      data: updateData,
    });

    return successResponse({ updated: true, taskId: task.id, action });
  } catch (error) {
    console.error('[github-webhook] エラー:', error);
    return errorResponse('Webhook processing failed', 500);
  }
}

async function createTaskFromIssue(
  issue: { node_id: string; number: number; title: string; body: string | null; labels: { name: string; color: string }[]; assignees: { login: string }[] },
  repoFullName: string,
  projectId: string,
  workspaceId: string,
  userId: string,
) {
  // デフォルトセクション取得
  const firstSection = await prisma.section.findFirst({
    where: { projectId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

  const task = await prisma.task.create({
    data: {
      title: issue.title,
      description: issue.body ?? null,
      projectId,
      sectionId: firstSection?.id ?? null,
      createdById: userId,
      githubIssueId: issue.number,
      githubIssueNodeId: issue.node_id,
      githubRepoFullName: repoFullName,
      githubIssueSyncedAt: new Date(),
      githubSyncSource: 'github',
      importedFromGitHub: true,
    },
  });

  // ラベル同期
  if (issue.labels?.length > 0) {
    await syncLabelsFromGitHub(task.id, workspaceId, issue.labels);
  }

  // 担当者同期
  if (issue.assignees?.length > 0) {
    await syncAssigneesFromGitHub(task.id, workspaceId, issue.assignees);
  }
}

async function syncLabelsFromGitHub(
  taskId: string,
  workspaceId: string,
  githubLabels: { name: string; color: string }[],
) {
  // GitHub上のラベル名を取得し、ワークスペースに存在するラベルとマッチ
  const labelNames = githubLabels.map((l) => l.name);

  // 存在しないラベルを自動作成
  for (const gl of githubLabels) {
    await prisma.label.upsert({
      where: { workspaceId_name: { workspaceId, name: gl.name } },
      update: {},
      create: {
        workspaceId,
        name: gl.name,
        color: `#${gl.color}`,
      },
    });
  }

  const matchedLabels = await prisma.label.findMany({
    where: { workspaceId, name: { in: labelNames } },
    select: { id: true },
  });
  const labelIds = matchedLabels.map((l) => l.id);

  // 現在のラベルを取得して差分更新
  const currentLabels = await prisma.taskLabel.findMany({
    where: { taskId },
    select: { labelId: true },
  });
  const currentIds = currentLabels.map((l) => l.labelId);
  const toAdd = labelIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !labelIds.includes(id));

  if (toAdd.length > 0 || toRemove.length > 0) {
    await prisma.$transaction([
      ...toRemove.map((labelId) =>
        prisma.taskLabel.deleteMany({ where: { taskId, labelId } })
      ),
      ...toAdd.map((labelId) =>
        prisma.taskLabel.create({ data: { taskId, labelId } })
      ),
    ]);
  }
}

async function syncAssigneesFromGitHub(
  taskId: string,
  workspaceId: string,
  githubAssignees: { login: string }[],
) {
  const logins = githubAssignees.map((a) => a.login);
  const userMappings = await prisma.gitHubUserMapping.findMany({
    where: { workspaceId, githubLogin: { in: logins } },
  });
  const userIds = userMappings.map((m) => m.userId);

  const currentAssignees = await prisma.taskAssignment.findMany({
    where: { taskId },
    select: { userId: true },
  });
  const currentIds = currentAssignees.map((a) => a.userId);
  const toAdd = userIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !userIds.includes(id));

  if (toAdd.length > 0 || toRemove.length > 0) {
    await prisma.$transaction([
      ...toRemove.map((userId) =>
        prisma.taskAssignment.deleteMany({ where: { taskId, userId } })
      ),
      ...toAdd.map((userId) =>
        prisma.taskAssignment.create({ data: { taskId, userId } })
      ),
    ]);
  }
}
