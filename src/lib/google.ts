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

  // トークンリフレッシュ時にDBを更新
  oauth2Client.on('tokens', async (tokens) => {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokens.access_token ?? account.access_token,
        expires_at: tokens.expiry_date
          ? Math.floor(tokens.expiry_date / 1000)
          : account.expires_at,
      },
    });
  });

  // 期限切れチェック＆リフレッシュ
  if (account.expires_at && account.expires_at * 1000 < Date.now()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
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
