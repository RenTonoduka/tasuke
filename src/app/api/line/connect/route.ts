import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import crypto from 'crypto';

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL!));
  }

  const clientId = process.env.LINE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'LINE_CLIENT_ID not configured' }, { status: 500 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://tasuke.app';
  const redirectUri = `${baseUrl}/api/line/callback`;
  const state = crypto.randomBytes(16).toString('hex');

  // stateをcookieに保存（CSRF対策）
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'profile openid',
  });

  const response = NextResponse.redirect(`https://access.line.me/oauth2/v2.1/authorize?${params}`);
  response.cookies.set('line_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10分
    path: '/',
  });

  return response;
}
