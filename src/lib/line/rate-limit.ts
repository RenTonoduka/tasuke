import prisma from '@/lib/prisma';

const DAILY_LIMIT = 50;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getJSTDateString(): string {
  const jstMs = Date.now() + JST_OFFSET_MS;
  const d = new Date(jstMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function checkRateLimit(lineUserId: string): Promise<boolean> {
  const date = getJSTDateString();

  const usage = await prisma.lineAIUsage.upsert({
    where: { lineUserId_date: { lineUserId, date } },
    create: { lineUserId, date, count: 1 },
    update: { count: { increment: 1 } },
  });

  return usage.count <= DAILY_LIMIT;
}
