import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { pushMessage } from '@/lib/line/client';
import { getAccessibleProjectIds } from '@/lib/project-access';
import { createNotification } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const tomorrowEnd = new Date(todayEnd);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const lineUsers = await prisma.lineUserMapping.findMany({
      where: { isFollowing: true, reminderEnabled: true },
    });

    let sentCount = 0;

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

      await pushMessage(lineUser.lineUserId, [{ type: 'text', text: lines.join('\n') }]);
      sentCount++;

      await createNotification({
        userId: lineUser.userId,
        type: 'line_reminder',
        message: `期限切れ${overdue.length}件、今日${dueToday.length}件、明日${dueTomorrow.length}件`,
      });
    }

    return NextResponse.json({ sentCount, totalUsers: lineUsers.length });
  } catch (error) {
    console.error('[cron/line-reminders] error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
