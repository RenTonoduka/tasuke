import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGitHubToken, githubApi } from '@/lib/github';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser();

    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: { workspace: { members: { some: { userId: user.id } } } },
      },
    });
    if (!task) return errorResponse('タスクが見つかりません', 404);
    if (!task.githubIssueId || !task.githubRepoFullName) {
      return errorResponse('このタスクはGitHub Issueと連携されていません', 400);
    }

    const token = await getGitHubToken(user.id);

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
      where: { id: params.id },
      data: {
        githubIssueSyncedAt: new Date(),
        githubSyncSource: 'tasuke',
      },
    });

    return successResponse({ synced: true, state: newState });
  } catch (error) {
    return handleApiError(error);
  }
}
