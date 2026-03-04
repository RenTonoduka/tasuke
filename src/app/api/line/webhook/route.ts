import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { processLineEvent } from '@/lib/line/event-processor';

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.LINE_CHANNEL_SECRET) return false;
  const hash = createHmac('SHA256', process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-line-signature');

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const events = body.events ?? [];

    const results = await Promise.allSettled(events.map(processLineEvent));
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[line-webhook] event processing failed:', result.reason);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[line-webhook] error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
