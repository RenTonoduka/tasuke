import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyChannelToken, pollChangesForChannel } from '@/lib/meeting/drive-watch';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const channelId = req.headers.get('x-goog-channel-id');
  const channelToken = req.headers.get('x-goog-channel-token');
  const resourceState = req.headers.get('x-goog-resource-state');

  if (!channelId) {
    return new NextResponse(null, { status: 400 });
  }

  // sync (registration ping) — just acknowledge
  if (resourceState === 'sync') {
    return new NextResponse(null, { status: 200 });
  }

  const channel = await prisma.driveWatchChannel.findUnique({
    where: { channelId },
    select: { id: true, userId: true, channelId: true, enabled: true },
  });
  if (!channel) return new NextResponse(null, { status: 200 });
  if (!channel.enabled) return new NextResponse(null, { status: 200 });
  if (!channelToken || !verifyChannelToken(channelToken, channel.channelId, channel.userId)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 200即返却 → 非同期処理（Vercel関数の挙動上、awaitしないと終了する場合あり）
  // ここではブロッキング実行（最大60s）。重い場合は別途キュー化を検討
  try {
    await pollChangesForChannel(channel.id);
  } catch (err) {
    console.error('[drive-webhook] poll failed:', err);
  }
  return new NextResponse(null, { status: 200 });
}
