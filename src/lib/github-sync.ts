import prisma from './prisma';
import { getGitHubToken, githubApi } from './github';

export async function syncTaskToGitHub(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });
  if (!task?.githubIssueId || !task.githubRepoFullName) return;

  const token = await getGitHubToken(userId);
  const newState = task.status === 'DONE' ? 'closed' : 'open';

  await githubApi(
    token,
    `/repos/${task.githubRepoFullName}/issues/${task.githubIssueId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: newState }),
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
