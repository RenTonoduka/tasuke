import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface LineTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token: string;
}

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://tasuke.app';

  try {
    // セッション確認
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.redirect(`${baseUrl}/login`);
    }

    // パラメータ取得
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const error = req.nextUrl.searchParams.get('error');

    if (error) {
      console.error('[line-callback] OAuth error:', error);
      return redirectWithError(baseUrl, session.user.id, 'LINE認証がキャンセルされました');
    }

    if (!code || !state) {
      return redirectWithError(baseUrl, session.user.id, 'パラメータが不足しています');
    }

    // CSRF検証
    const savedState = req.cookies.get('line_oauth_state')?.value;
    if (!savedState || savedState !== state) {
      console.error('[line-callback] state mismatch');
      return redirectWithError(baseUrl, session.user.id, '不正なリクエストです');
    }

    // アクセストークン取得
    const redirectUri = `${baseUrl}/api/line/callback`;
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINE_CLIENT_ID!,
        client_secret: process.env.LINE_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[line-callback] token error:', err);
      return redirectWithError(baseUrl, session.user.id, 'トークン取得に失敗しました');
    }

    const tokenData: LineTokenResponse = await tokenRes.json();

    // プロフィール取得
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      console.error('[line-callback] profile error:', await profileRes.text());
      return redirectWithError(baseUrl, session.user.id, 'プロフィール取得に失敗しました');
    }

    const profile: LineProfile = await profileRes.json();
    console.log('[line-callback] success: userId=', profile.userId, 'name=', profile.displayName);

    // ワークスペース取得
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { joinedAt: 'asc' },
      select: { workspaceId: true, workspace: { select: { slug: true } } },
    });

    if (!member) {
      return redirectWithError(baseUrl, session.user.id, 'ワークスペースが見つかりません');
    }

    // Account レコード作成/更新（NextAuth互換）
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'line',
          providerAccountId: profile.userId,
        },
      },
      update: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
        id_token: tokenData.id_token,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
      },
      create: {
        userId: session.user.id,
        type: 'oauth',
        provider: 'line',
        providerAccountId: profile.userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
        id_token: tokenData.id_token,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
      },
    });

    // LineUserMapping 作成/更新
    await prisma.lineUserMapping.upsert({
      where: {
        userId_workspaceId: {
          userId: session.user.id,
          workspaceId: member.workspaceId,
        },
      },
      update: {
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl ?? null,
        isFollowing: true,
        linkingCode: null,
      },
      create: {
        lineUserId: profile.userId,
        userId: session.user.id,
        workspaceId: member.workspaceId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl ?? null,
      },
    });

    // state cookieクリア＆リダイレクト
    const redirectUrl = `${baseUrl}/${member.workspace.slug}/settings/line`;
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('line_oauth_state');
    return response;
  } catch (error) {
    console.error('[line-callback] unexpected error:', error);
    return NextResponse.redirect(`${baseUrl}/login`);
  }
}

function redirectWithError(baseUrl: string, _userId: string, message: string) {
  const url = new URL('/login', baseUrl);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url.toString());
}
