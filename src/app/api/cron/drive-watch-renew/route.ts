import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { renewExpiringChannels } from '@/lib/meeting/drive-watch';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    return false;
  }
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
