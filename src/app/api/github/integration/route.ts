import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await requireAuthUser();
    const account = await prisma.account.findFirst({
      where: { userId: user.id, provider: 'github' },
      select: { providerAccountId: true, scope: true },
    });

    if (!account) {
      return successResponse({ connected: false });
    }

    // GitHubユーザー名を取得
    let githubUsername: string | null = null;
    try {
      const ghAccount = await prisma.account.findFirst({
        where: { userId: user.id, provider: 'github' },
        select: { access_token: true },
      });
      if (ghAccount?.access_token) {
        const res = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${ghAccount.access_token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Tasuke-App',
          },
        });
        if (res.ok) {
          const data = await res.json();
          githubUsername = data.login;
        }
      }
    } catch {}

    return successResponse({
      connected: true,
      githubUsername,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireAuthUser();
    await prisma.account.deleteMany({
      where: { userId: user.id, provider: 'github' },
    });
    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
