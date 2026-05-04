import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { pollChangesForChannel } from '@/lib/meeting/drive-watch';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cronは "Authorization: Bearer $CRON_SECRET" を自動付与
  const auth = req.headers.get('authorization') || '';
  return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  try {
    // 有効化中の全チャネルでポーリング（webhookが取りこぼしても定期的に拾う）
    const channels = await prisma.driveWatchChannel.findMany({
      where: { enabled: true },
      select: { id: true, userId: true, workspaceId: true },
    });

    let totalIngested = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const ch of channels) {
      try {
        const r = await pollChangesForChannel(ch.id);
        totalIngested += r.ingested;
        totalSkipped += r.skipped;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[drive-poll] failed:', ch.id, msg);
        errors.push(`${ch.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      processed: channels.length,
      ingested: totalIngested,
      skipped: totalSkipped,
      errors,
    });
  } catch (err) {
    console.error('[drive-poll] fatal:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
