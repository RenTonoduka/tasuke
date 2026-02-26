import prisma from './prisma';
import { getGitHubToken, githubApi } from './github';

type SyncField = 'title' | 'description' | 'status' | 'labels' | 'assignees';

interface SyncOptions {
  fields?: SyncField[];
}

export async function syncTaskToGitHub(taskId: string, userId: string, options?: SyncOptions) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      labels: { include: { label: true } },
      assignees: true,
      project: { select: { workspaceId: true } },
    },
  });
  if (!task?.githubIssueId || !task.githubRepoFullName) return;

  // ループ防止: GitHub側から来た更新で5秒以内ならスキップ
  if (
    task.githubSyncSource === 'github' &&
    task.githubIssueSyncedAt &&
    Date.now() - task.githubIssueSyncedAt.getTime() < 5000
  ) {
    return;
  }

  const token = await getGitHubToken(userId);
  const fields = options?.fields;

  const body: Record<string, unknown> = {};

  if (!fields || fields.includes('status')) {
    body.state = task.status === 'DONE' ? 'closed' : 'open';
  }
  if (!fields || fields.includes('title')) {
    body.title = task.title;
  }
  if (!fields || fields.includes('description')) {
    body.body = task.description ?? '';
  }
  if (!fields || fields.includes('labels')) {
    body.labels = task.labels.map((tl) => tl.label.name);
  }
  if (!fields || fields.includes('assignees')) {
    // GitHubUserMappingでTasukeユーザー→GitHubログイン名を解決
    const userIds = task.assignees.map((a) => a.userId);
    if (userIds.length > 0) {
      const mappings = await prisma.gitHubUserMapping.findMany({
        where: { workspaceId: task.project.workspaceId, userId: { in: userIds } },
      });
      body.assignees = mappings.map((m) => m.githubLogin);
    } else {
      body.assignees = [];
    }
  }

  await githubApi(
    token,
    `/repos/${task.githubRepoFullName}/issues/${task.githubIssueId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  await prisma.task.update({
    where: { id: taskId },
    data: {
      githubIssueSyncedAt: new Date(),
      githubSyncSource: 'tasuke',
    },
  });
}
