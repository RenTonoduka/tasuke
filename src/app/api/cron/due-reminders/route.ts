import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function verifyToken(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!authHeader || !secret) return false;
  const token = authHeader.replace('Bearer ', '');
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

function getJSTBoundaries() {
  const jstDate = new Date(Date.now() + JST_OFFSET_MS);
  const y = jstDate.getUTCFullYear();
  const m = jstDate.getUTCMonth();
  const d = jstDate.getUTCDate();
  const todayStart = new Date(Date.UTC(y, m, d) - JST_OFFSET_MS);
  const todayEnd = new Date(Date.UTC(y, m, d + 1) - JST_OFFSET_MS);
  const tomorrowEnd = new Date(Date.UTC(y, m, d + 2) - JST_OFFSET_MS);
  return { todayStart, todayEnd, tomorrowEnd };
}

/**
 * GET /api/cron/due-reminders
 * 期限リマインドを「アプリ内通知」として担当者へ送る（LINE連携の有無に関わらず）。
 * 1ユーザーにつき1件のサマリ通知を作成。
 */
export async function GET(req: NextRequest) {
  if (!verifyToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { todayStart, todayEnd, tomorrowEnd } = getJSTBoundaries();

    // 期限切れ〜明日期限の未完了タスク（担当者付き）を取得
    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        status: { notIn: ['DONE', 'ARCHIVED'] },
        dueDate: { lt: tomorrowEnd },
        assignees: { some: {} },
      },
      select: { dueDate: true, assignees: { select: { userId: true } } },
    });

    // ユーザー別に件数集計
    const perUser = new Map<string, { overdue: number; today: number; tomorrow: number }>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const bucket =
        t.dueDate < todayStart ? 'overdue' : t.dueDate < todayEnd ? 'today' : 'tomorrow';
      for (const a of t.assignees) {
        const cur = perUser.get(a.userId) ?? { overdue: 0, today: 0, tomorrow: 0 };
        cur[bucket]++;
        perUser.set(a.userId, cur);
      }
    }

    let created = 0;
    for (const [userId, c] of Array.from(perUser.entries())) {
      if (c.overdue === 0 && c.today === 0 && c.tomorrow === 0) continue;
      await createNotification({
        userId,
        type: 'due_reminder',
        message: `期限リマインド: 期限切れ${c.overdue}件・今日${c.today}件・明日${c.tomorrow}件`,
      });
      created++;
    }

    return NextResponse.json({ created, users: perUser.size });
  } catch (error) {
    console.error('[cron/due-reminders] error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
