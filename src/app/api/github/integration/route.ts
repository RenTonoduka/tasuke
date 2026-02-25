import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encryptPAT } from '@/lib/github-crypto';
import { githubApi, GitHubApiError } from '@/lib/github';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const patSchema = z.object({
  pat: z.string().min(1, 'トークンを入力してください'),
});

export async function GET() {
  try {
    const user = await requireAuthUser();
    const integration = await prisma.gitHubIntegration.findUnique({
      where: { userId: user.id },
      select: { githubUsername: true, createdAt: true, updatedAt: true },
    });
    return successResponse({ integration });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const { pat } = patSchema.parse(body);

    // PATを検証（GitHub APIでユーザー情報取得）
    let githubUsername: string;
    try {
      const ghUser = await githubApi<{ login: string }>(pat, '/user');
      githubUsername = ghUser.login;
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 401) {
        return errorResponse('無効なトークンです。正しいPersonal Access Tokenを入力してください', 400);
      }
      throw err;
    }

    // スコープ確認（repoスコープが必要）
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Tasuke-App',
      },
    });
    const scopes = res.headers.get('x-oauth-scopes') || '';
    if (!scopes.includes('repo')) {
      return errorResponse('トークンにrepoスコープが必要です。Fine-grained tokenの場合はIssues権限が必要です', 400);
    }

    const encrypted = encryptPAT(pat);
    await prisma.gitHubIntegration.upsert({
      where: { userId: user.id },
      create: { userId: user.id, encryptedPat: encrypted, githubUsername },
      update: { encryptedPat: encrypted, githubUsername },
    });

    return successResponse({ githubUsername });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireAuthUser();
    await prisma.gitHubIntegration.deleteMany({ where: { userId: user.id } });
    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
