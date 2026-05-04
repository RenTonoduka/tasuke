import { NextRequest, NextResponse } from 'next/server';
import { renewExpiringChannels } from '@/lib/meeting/drive-watch';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET) return false;
  return auth === expected;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  try {
    const result = await renewExpiringChannels();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[cron-renew] failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
