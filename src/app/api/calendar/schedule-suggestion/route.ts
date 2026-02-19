import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { getGoogleClient, getCalendarClient } from '@/lib/google';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { findFreeSlots, generateScheduleSuggestions } from '@/lib/schedule';
import type { CalendarEvent, SchedulableTask } from '@/lib/schedule';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const {
      projectId,
      workStart = 9,
      workEnd = 18,
      skipWeekends = true,
    } = body;

    // 対象タスク取得: 未完了 + 期限あり + 見積もり時間あり + 自分が所属するワークスペース
    const whereClause: Record<string, unknown> = {
      status: { in: ['TODO', 'IN_PROGRESS'] },
      dueDate: { not: null },
      estimatedHours: { not: null },
      project: {
        workspace: {
          members: { some: { userId: user.id } },
        },
      },
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        dueDate: true,
        estimatedHours: true,
        priority: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    if (tasks.length === 0) {
      return successResponse({
        suggestions: [],
        unschedulable: [],
        totalFreeHours: 0,
        message: '見積もり時間と期限が設定されたタスクがありません',
      });
    }

    // カレンダーイベント取得（今日〜最遠期限日+1日）
    const now = new Date();
    const maxDueDate = tasks.reduce(
      (max, t) => (t.dueDate && t.dueDate > max ? t.dueDate : max),
      now
    );
    const timeMax = new Date(maxDueDate);
    timeMax.setDate(timeMax.getDate() + 1);

    let calendarEvents: CalendarEvent[] = [];
    try {
      const auth = await getGoogleClient(user.id);
      const calendar = getCalendarClient(auth);
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        timeZone: 'Asia/Tokyo',
        fields: 'items(id,summary,start,end,status)',
      });
      calendarEvents = (response.data.items ?? [])
        .filter((e) => e.status !== 'cancelled')
        .map((e) => ({
          start: e.start?.dateTime ?? e.start?.date ?? '',
          end: e.end?.dateTime ?? e.end?.date ?? '',
          allDay: !!e.start?.date,
        }));
    } catch {
      // カレンダー取得失敗時は予定なしとして計算続行
      console.warn('カレンダーイベント取得スキップ');
    }

    // 空き時間算出
    const freeSlots = findFreeSlots(calendarEvents, now, timeMax, workStart, workEnd, skipWeekends);

    // 逆算スケジュール生成
    const schedulableTasks: SchedulableTask[] = tasks
      .filter((t): t is typeof t & { dueDate: Date; estimatedHours: number } =>
        t.dueDate !== null && t.estimatedHours !== null
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate.toISOString(),
        estimatedHours: t.estimatedHours,
        priority: t.priority as SchedulableTask['priority'],
      }));

    const result = generateScheduleSuggestions(schedulableTasks, freeSlots);

    // 見積もり未設定タスク数も返す
    const unestimatedCount = await prisma.task.count({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueDate: { not: null },
        estimatedHours: null,
        project: {
          workspace: {
            members: { some: { userId: user.id } },
          },
        },
        ...(projectId ? { projectId } : {}),
      },
    });

    return successResponse({
      ...result,
      unestimatedCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Google')) {
      return errorResponse(error.message, 401);
    }
    return handleApiError(error);
  }
}
