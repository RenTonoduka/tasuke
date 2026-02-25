import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGitHubToken, githubApi } from '@/lib/github';
import { successResponse, handleApiError } from '@/lib/api-utils';

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  private: boolean;
  open_issues_count: number;
  has_issues: boolean;
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    const token = await getGitHubToken(user.id);

    const repos = await githubApi<GitHubRepo[]>(
      token,
      '/user/repos?per_page=100&sort=updated&type=all'
    );

    // Issueが有効なリポジトリのみ
    const filtered = repos.filter((r) => r.has_issues);

    const mappings = await prisma.gitHubRepoMapping.findMany({
      where: { userId: user.id },
    });
    const mappingMap = new Map(
      mappings.map((m) => [m.githubRepoFullName, m.projectId])
    );

    return successResponse({
      repos: filtered.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        owner: r.owner.login,
        description: r.description,
        isPrivate: r.private,
        openIssuesCount: r.open_issues_count,
        mappedProjectId: mappingMap.get(r.full_name) ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
