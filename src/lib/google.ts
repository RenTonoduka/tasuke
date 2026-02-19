import { google, Auth } from 'googleapis';
import prisma from './prisma';

export async function getGoogleClient(userId: string): Promise<Auth.OAuth2Client> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
  });

  if (!account?.access_token) {
    throw new Error('Googleアカウントが連携されていません');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  // トークンリフレッシュ時にDBを更新（エラーをログ出力）
  oauth2Client.on('tokens', async (tokens) => {
    try {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token ?? account.access_token,
          expires_at: tokens.expiry_date
            ? Math.floor(tokens.expiry_date / 1000)
            : account.expires_at,
        },
      });
    } catch (err) {
      console.error('[google.ts] トークン更新のDB保存に失敗:', account.id, err);
    }
  });

  // 期限切れの5分前にリフレッシュ（競合軽減）
  const EXPIRY_MARGIN_SECONDS = 300;
  if (account.expires_at && (account.expires_at - EXPIRY_MARGIN_SECONDS) < Date.now() / 1000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      // DB同期更新（イベントに任せない）
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: credentials.access_token ?? account.access_token,
          expires_at: credentials.expiry_date
            ? Math.floor(credentials.expiry_date / 1000)
            : account.expires_at,
        },
      });
    } catch (err) {
      console.error('[google.ts] トークンリフレッシュに失敗:', account.id, err);
      throw new Error('Googleアカウントの再認証が必要です。ログアウトして再度ログインしてください。');
    }
  }

  return oauth2Client;
}

export function getCalendarClient(auth: Auth.OAuth2Client) {
  return google.calendar({ version: 'v3', auth });
}

export function getTasksClient(auth: Auth.OAuth2Client) {
  return google.tasks({ version: 'v1', auth });
}

export function getDriveClient(auth: Auth.OAuth2Client) {
  return google.drive({ version: 'v3', auth });
}

export function getSheetsClient(auth: Auth.OAuth2Client) {
  return google.sheets({ version: 'v4', auth });
}
