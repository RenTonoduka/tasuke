import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type { drive_v3 } from 'googleapis';
import prisma from '@/lib/prisma';
import { getGoogleClient, getDriveClient } from '@/lib/google';
import { extractMeeting } from './extractor';

const CHANNEL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RENEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function getHmacSecret(): string {
  const s = process.env.DRIVE_WEBHOOK_HMAC_SECRET;
  if (!s) throw new Error('DRIVE_WEBHOOK_HMAC_SECRET 環境変数が未設定です');
  return s;
}

export function signChannelToken(channelId: string, userId: string): string {
  return createHmac('sha256', getHmacSecret()).update(`${channelId}:${userId}`).digest('base64url');
}

export function verifyChannelToken(token: string, channelId: string, userId: string): boolean {
  try {
    const expected = signChannelToken(channelId, userId);
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getWebhookAddress(): string {
  const base = process.env.NEXTAUTH_URL || 'https://tasuke.app';
  return `${base.replace(/\/$/, '')}/api/drive/webhook`;
}

interface RegisterArgs {
  userId: string;
  workspaceId: string;
}

export async function registerDriveWatch({ userId, workspaceId }: RegisterArgs) {
  const auth = await getGoogleClient(userId);
  const drive = getDriveClient(auth);

  // 既存チャネルがあれば先にstop（best-effort）
  const existing = await prisma.driveWatchChannel.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (existing && existing.enabled) {
    await stopChannelSafe(userId, existing.channelId, existing.resourceId).catch(() => {});
  }

  // 1) startPageToken取得
  const startToken = (await drive.changes.getStartPageToken()).data.startPageToken;
  if (!startToken) throw new Error('startPageTokenが取得できません');

  // 2) チャネル登録
  const channelId = randomUUID();
  const expirationMs = Date.now() + CHANNEL_TTL_MS;
  const watchRes = await drive.changes.watch({
    pageToken: startToken,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: getWebhookAddress(),
      token: signChannelToken(channelId, userId),
      expiration: String(expirationMs),
    },
  });

  const resourceId = watchRes.data.resourceId;
  if (!resourceId) throw new Error('Drive watchがresourceIdを返しませんでした');

  const expirationFromGoogle = watchRes.data.expiration ? Number(watchRes.data.expiration) : expirationMs;

  return prisma.driveWatchChannel.upsert({
    where: { userId_workspaceId: { userId, workspaceId } },
    update: {
      channelId,
      resourceId,
      pageToken: startToken,
      expiration: new Date(expirationFromGoogle),
      enabled: true,
    },
    create: {
      userId,
      workspaceId,
      channelId,
      resourceId,
      pageToken: startToken,
      expiration: new Date(expirationFromGoogle),
    },
  });
}

async function stopChannelSafe(userId: string, channelId: string, resourceId: string) {
  const auth = await getGoogleClient(userId);
  const drive = getDriveClient(auth);
  await drive.channels.stop({ requestBody: { id: channelId, resourceId } });
}

export async function stopDriveWatch(userId: string, workspaceId: string) {
  const channel = await prisma.driveWatchChannel.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!channel) return null;
  if (channel.enabled) {
    await stopChannelSafe(userId, channel.channelId, channel.resourceId).catch((err) => {
      console.error('[drive-watch] channels.stop failed:', err);
    });
  }
  return prisma.driveWatchChannel.update({
    where: { id: channel.id },
    data: { enabled: false },
  });
}

export function isMeetingTranscript(name: string | null | undefined): boolean {
  if (!name) return false;
  return /議事録|Meeting notes|Transcript|Notes from your meeting|Gemini.*notes/i.test(name);
}

interface DriveFileLite {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string | null;
  ownerEmail?: string | null;
}

export async function pollChangesForChannel(channelDbId: string): Promise<{ ingested: number; skipped: number }> {
  const channel = await prisma.driveWatchChannel.findUnique({ where: { id: channelDbId } });
  if (!channel || !channel.enabled) return { ingested: 0, skipped: 0 };

  const auth = await getGoogleClient(channel.userId);
  const drive = getDriveClient(auth);

  let pageToken: string | null = channel.pageToken;
  let ingested = 0;
  let skipped = 0;

  while (pageToken) {
    const res = (await drive.changes.list({
      pageToken,
      pageSize: 100,
      includeRemoved: false,
      restrictToMyDrive: true,
      fields: 'changes(fileId,file(id,name,mimeType,createdTime,modifiedTime,owners(emailAddress),webViewLink,driveId)),nextPageToken,newStartPageToken',
    })) as { data: drive_v3.Schema$ChangeList };

    for (const change of res.data.changes ?? []) {
      const f = change.file;
      if (!f || !f.id || !f.name) {
        skipped++;
        continue;
      }
      // Shared Drive対象外
      if (f.driveId) {
        skipped++;
        continue;
      }
      if (f.mimeType !== 'application/vnd.google-apps.document') {
        skipped++;
        continue;
      }
      if (!isMeetingTranscript(f.name)) {
        skipped++;
        continue;
      }
      const existing = await prisma.meeting.findUnique({ where: { driveFileId: f.id } });
      if (existing) {
        skipped++;
        continue;
      }
      await ingestDriveFile(channel.userId, channel.workspaceId, {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        webViewLink: f.webViewLink ?? null,
        ownerEmail: f.owners?.[0]?.emailAddress ?? null,
      });
      ingested++;
    }

    if (res.data.newStartPageToken) {
      await prisma.driveWatchChannel.update({
        where: { id: channelDbId },
        data: { pageToken: res.data.newStartPageToken, lastNotifiedAt: new Date() },
      });
      pageToken = null;
    } else {
      pageToken = res.data.nextPageToken ?? null;
    }
  }

  return { ingested, skipped };
}

async function ingestDriveFile(userId: string, workspaceId: string, file: DriveFileLite) {
  const auth = await getGoogleClient(userId);
  const drive = getDriveClient(auth);

  let transcript = '';
  try {
    const exportRes = await drive.files.export(
      { fileId: file.id, mimeType: 'text/plain' },
      { responseType: 'text' },
    );
    transcript = String(exportRes.data ?? '');
  } catch (err) {
    console.error('[drive-watch] export failed:', file.id, err);
    // エラーでもMeetingレコードはFAILEDで残しておく（再処理判断用）
    await prisma.meeting.create({
      data: {
        workspaceId,
        createdById: userId,
        source: 'DRIVE_WATCH',
        status: 'FAILED',
        title: file.name,
        transcript: '',
        driveFileId: file.id,
        driveFileName: file.name,
        driveWebViewLink: file.webViewLink ?? null,
        driveOwnerEmail: file.ownerEmail ?? null,
        failureReason: err instanceof Error ? err.message : String(err),
      },
    });
    return;
  }

  if (transcript.trim().length < 10) {
    console.warn('[drive-watch] transcript too short, skipping:', file.id);
    return;
  }

  await extractMeeting({
    workspaceId,
    userId,
    title: file.name,
    transcript,
    source: 'DRIVE_WATCH',
    driveFileId: file.id,
    driveFileName: file.name,
    driveWebViewLink: file.webViewLink ?? null,
    driveOwnerEmail: file.ownerEmail ?? null,
  });
}

export async function renewExpiringChannels(): Promise<{ renewed: number; failed: number }> {
  const soon = new Date(Date.now() + RENEW_THRESHOLD_MS);
  const channels = await prisma.driveWatchChannel.findMany({
    where: { enabled: true, expiration: { lt: soon } },
  });
  let renewed = 0;
  let failed = 0;
  for (const ch of channels) {
    try {
      await registerDriveWatch({ userId: ch.userId, workspaceId: ch.workspaceId });
      renewed++;
    } catch (err) {
      console.error('[drive-watch] renew failed:', ch.id, err);
      failed++;
    }
  }
  return { renewed, failed };
}
