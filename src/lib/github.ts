import { decryptPAT } from './github-crypto';
import prisma from './prisma';

export class GitHubApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export async function getGitHubToken(userId: string): Promise<string> {
  const integration = await prisma.gitHubIntegration.findUnique({
    where: { userId },
  });
  if (!integration) {
    throw new Error('GitHub連携が設定されていません');
  }
  return decryptPAT(integration.encryptedPat);
}

export async function githubApi<T = unknown>(
  token: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Tasuke-App',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new GitHubApiError(res.status, body.message ?? 'GitHub APIエラー');
  }
  return res.json() as Promise<T>;
}
