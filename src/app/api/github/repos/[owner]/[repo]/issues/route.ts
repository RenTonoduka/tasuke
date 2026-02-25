import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGitHubToken, githubApi } from '@/lib/github';
import { parseChecklistItems } from '@/lib/github-checklist';
import { successResponse, handleApiError } from '@/lib/api-utils';

interface GitHubIssue {
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  state: string;
  labels: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  try {
    const user = await requireAuthUser();
    const token = await getGitHubToken(user.id);
    const fullName = `${params.owner}/${params.repo}`;

    const issues = await githubApi<GitHubIssue[]>(
      token,
      `/repos/${fullName}/issues?state=open&per_page=100&sort=updated`
    );

    // PRを除外
    const filtered = issues.filter((i) => !i.pull_request);

    // 取込済チェック
    const nodeIds = filtered.map((i) => i.node_id);
    const existingTasks = await prisma.task.findMany({
      where: { githubIssueNodeId: { in: nodeIds } },
      select: { id: true, githubIssueNodeId: true },
    });
    const existingMap = new Map(
      existingTasks.map((t) => [t.githubIssueNodeId, t.id])
    );

    return successResponse({
      issues: filtered.map((i) => {
        const checklistItems = parseChecklistItems(i.body);
        return {
          number: i.number,
          nodeId: i.node_id,
          title: i.title,
          body: i.body,
          state: i.state,
          labels: i.labels.map((l) => ({ name: l.name, color: `#${l.color}` })),
          createdAt: i.created_at,
          updatedAt: i.updated_at,
          alreadyImported: existingMap.has(i.node_id),
          tasukeTaskId: existingMap.get(i.node_id) ?? null,
          checklistItems,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
