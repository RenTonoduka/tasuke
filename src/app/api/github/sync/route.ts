import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGitHubToken, githubApi } from '@/lib/github';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const syncSchema = z.object({
  githubRepoFullName: z.string().min(1),
  projectId: z.string().min(1),
  workspaceId: z.string().min(1),
});

interface GitHubIssueResponse {
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  state: string;
  labels: { name: string; color: string }[];
  assignees: { login: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { githubRepoFullName, projectId, workspaceId } = syncSchema.parse(await req.json());

    // 権限チェック
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    });
    if (!membership) return errorResponse('アクセス権がありません', 403);
    if (membership.role === 'VIEWER') return errorResponse('閲覧者は同期できません', 403);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });
    if (!project || project.workspaceId !== workspaceId) {
      return errorResponse('プロジェクトが見つかりません', 404);
    }

    const token = await getGitHubToken(user.id);

    // ページネーションで全Issue取得
    const allIssues: GitHubIssueResponse[] = [];
    let page = 1;
    while (true) {
      const batch = await githubApi<GitHubIssueResponse[]>(
        token,
        `/repos/${githubRepoFullName}/issues?state=all&per_page=100&page=${page}&sort=created&direction=asc`
      );
      if (batch.length === 0) break;
      // プルリクエストを除外（GitHub APIはIssueとPRを一緒に返す）
      allIssues.push(...batch.filter((i) => !('pull_request' in i)));
      if (batch.length < 100) break;
      page++;
    }

    // 既存タスクをnode_idで取得
    const nodeIds = allIssues.map((i) => i.node_id);
    const existingTasks = await prisma.task.findMany({
      where: { githubIssueNodeId: { in: nodeIds } },
      include: {
        labels: { include: { label: true } },
        assignees: true,
      },
    });
    const existingMap = new Map(existingTasks.map((t) => [t.githubIssueNodeId, t]));

    // position計算
    const maxPos = await prisma.task.aggregate({
      where: { projectId },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? 0) + 1;

    let created = 0;
    let updated = 0;

    // バッチトランザクション（50件ずつ）
    const BATCH_SIZE = 50;
    for (let i = 0; i < allIssues.length; i += BATCH_SIZE) {
      const batch = allIssues.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(async (tx) => {
        for (const issue of batch) {
          const existing = existingMap.get(issue.node_id);
          const status = issue.state === 'closed' ? 'DONE' as const : 'TODO' as const;

          if (existing) {
            // 既存タスクを更新
            await tx.task.update({
              where: { id: existing.id },
              data: {
                title: issue.title,
                description: issue.body ?? null,
                status,
                completedAt: status === 'DONE' ? (existing.completedAt ?? new Date()) : null,
                githubIssueSyncedAt: new Date(),
                githubSyncSource: 'github',
              },
            });

            // ラベル同期
            await syncLabelsInTx(tx, existing.id, workspaceId, issue.labels ?? []);
            // 担当者同期
            await syncAssigneesInTx(tx, existing.id, workspaceId, issue.assignees ?? []);

            updated++;
          } else {
            // 新規タスク作成
            const task = await tx.task.create({
              data: {
                title: issue.title,
                description: issue.body ?? null,
                status,
                completedAt: status === 'DONE' ? new Date() : null,
                projectId,
                createdById: user.id,
                position: position++,
                githubIssueId: issue.number,
                githubIssueNodeId: issue.node_id,
                githubRepoFullName,
                githubIssueSyncedAt: new Date(),
                importedFromGitHub: true,
                githubSyncSource: 'github',
              },
            });

            // ラベル同期
            if (issue.labels?.length > 0) {
              await syncLabelsInTx(tx, task.id, workspaceId, issue.labels);
            }
            // 担当者同期
            if (issue.assignees?.length > 0) {
              await syncAssigneesInTx(tx, task.id, workspaceId, issue.assignees);
            }

            created++;
          }
        }
      });
    }

    // マッピングを更新/作成
    await prisma.gitHubRepoMapping.upsert({
      where: { userId_githubRepoFullName: { userId: user.id, githubRepoFullName } },
      update: { projectId, workspaceId },
      create: { userId: user.id, githubRepoFullName, projectId, workspaceId },
    });

    return successResponse({ total: allIssues.length, created, updated });
  } catch (error) {
    return handleApiError(error);
  }
}

// トランザクション内でラベルを同期
async function syncLabelsInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  taskId: string,
  workspaceId: string,
  githubLabels: { name: string; color: string }[],
) {
  const labelNames = githubLabels.map((l) => l.name);

  // ラベルを確保（存在しなければ作成）
  for (const gl of githubLabels) {
    await tx.label.upsert({
      where: { workspaceId_name: { workspaceId, name: gl.name } },
      update: {},
      create: { workspaceId, name: gl.name, color: `#${gl.color}` },
    });
  }

  const matchedLabels = await tx.label.findMany({
    where: { workspaceId, name: { in: labelNames } },
    select: { id: true },
  });
  const labelIds = matchedLabels.map((l) => l.id);

  const currentLabels = await tx.taskLabel.findMany({
    where: { taskId },
    select: { labelId: true },
  });
  const currentIds = currentLabels.map((l) => l.labelId);
  const toAdd = labelIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !labelIds.includes(id));

  for (const labelId of toRemove) {
    await tx.taskLabel.deleteMany({ where: { taskId, labelId } });
  }
  for (const labelId of toAdd) {
    await tx.taskLabel.create({ data: { taskId, labelId } });
  }
}

// トランザクション内で担当者を同期
async function syncAssigneesInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  taskId: string,
  workspaceId: string,
  githubAssignees: { login: string }[],
) {
  const logins = githubAssignees.map((a) => a.login);
  const userMappings = await tx.gitHubUserMapping.findMany({
    where: { workspaceId, githubLogin: { in: logins } },
  });
  const userIds = userMappings.map((m) => m.userId);

  const currentAssignees = await tx.taskAssignment.findMany({
    where: { taskId },
    select: { userId: true },
  });
  const currentIds = currentAssignees.map((a) => a.userId);
  const toAdd = userIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !userIds.includes(id));

  for (const userId of toRemove) {
    await tx.taskAssignment.deleteMany({ where: { taskId, userId } });
  }
  for (const userId of toAdd) {
    await tx.taskAssignment.create({ data: { taskId, userId } });
  }
}
