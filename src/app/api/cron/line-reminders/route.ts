import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { pushMessage } from '@/lib/line/client';
import { getAccessibleProjectIds } from '@/lib/project-access';
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
  const nowUTC = Date.now();
  const jstMs = nowUTC + JST_OFFSET_MS;
  const jstDate = new Date(jstMs);
  const y = jstDate.getUTCFullYear();
  const m = jstDate.getUTCMonth();
  const d = jstDate.getUTCDate();
  const todayStart = new Date(Date.UTC(y, m, d) - JST_OFFSET_MS);
  const todayEnd = new Date(Date.UTC(y, m, d + 1) - JST_OFFSET_MS);
  const tomorrowEnd = new Date(Date.UTC(y, m, d + 2) - JST_OFFSET_MS);
  return { todayStart, todayEnd, tomorrowEnd };
}

export async function GET(req: NextRequest) {
  if (!verifyToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { todayStart, todayEnd, tomorrowEnd } = getJSTBoundaries();

    const lineUsers = await prisma.lineUserMapping.findMany({
      where: { isFollowing: true, reminderEnabled: true },
    });

    let sentCount = 0;
    let failCount = 0;

    for (const lineUser of lineUsers) {
      const projectIds = await getAccessibleProjectIds(lineUser.userId, lineUser.workspaceId);
      const baseWhere = {
        projectId: { in: projectIds },
        parentId: null,
        status: { notIn: ['DONE' as const, 'ARCHIVED' as const] },
        OR: [
          { assignees: { some: { userId: lineUser.userId } } },
          { createdById: lineUser.userId },
        ],
      };

      const [overdue, dueToday, dueTomorrow] = await Promise.all([
        prisma.task.findMany({
          where: { ...baseWhere, dueDate: { lt: todayStart } },
          select: { title: true },
          take: 5,
        }),
        prisma.task.findMany({
          where: { ...baseWhere, dueDate: { gte: todayStart, lt: todayEnd } },
          select: { title: true },
          take: 5,
        }),
        prisma.task.findMany({
          where: { ...baseWhere, dueDate: { gte: todayEnd, lt: tomorrowEnd } },
          select: { title: true },
          take: 5,
        }),
      ]);

      if (overdue.length === 0 && dueToday.length === 0 && dueTomorrow.length === 0) {
        continue;
      }

      const lines: string[] = ['おはようございます！タスクのリマインダーです。', ''];

      if (overdue.length > 0) {
        lines.push(`⚠️ 期限切れ: ${overdue.length}件`);
        overdue.forEach(t => lines.push(`  ・${t.title}`));
        lines.push('');
      }
      if (dueToday.length > 0) {
        lines.push(`📅 今日期限: ${dueToday.length}件`);
        dueToday.forEach(t => lines.push(`  ・${t.title}`));
        lines.push('');
      }
      if (dueTomorrow.length > 0) {
        lines.push(`📋 明日期限: ${dueTomorrow.length}件`);
        dueTomorrow.forEach(t => lines.push(`  ・${t.title}`));
      }

      lines.push('', '「ダッシュボード」で詳細を確認できます。');

      const success = await pushMessage(lineUser.lineUserId, [{ type: 'text', text: lines.join('\n') }]);
      if (success) {
        sentCount++;
      } else {
        failCount++;
        console.error(`[cron/line-reminders] push failed for user: ${lineUser.lineUserId}`);
      }

      await createNotification({
        userId: lineUser.userId,
        type: 'line_reminder',
        message: `期限切れ${overdue.length}件、今日${dueToday.length}件、明日${dueTomorrow.length}件`,
      });
    }

    return NextResponse.json({ sentCount, failCount, totalUsers: lineUsers.length });
  } catch (error) {
    console.error('[cron/line-reminders] error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
