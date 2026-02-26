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
      myTasksOnly = false,
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

    if (myTasksOnly) {
      whereClause.assignees = { some: { userId: user.id } };
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

    // 未設定タスク一覧（期限 or 見積もりが未設定）を先に取得
    const incompleteWhere: Record<string, unknown> = {
      status: { in: ['TODO', 'IN_PROGRESS'] },
      OR: [
        { dueDate: null },
        { estimatedHours: null },
      ],
      project: {
        workspace: {
          members: { some: { userId: user.id } },
        },
      },
    };
    if (projectId) incompleteWhere.projectId = projectId;
    if (myTasksOnly) incompleteWhere.assignees = { some: { userId: user.id } };

    const incompleteTasks = await prisma.task.findMany({
      where: incompleteWhere,
      select: { id: true, title: true, priority: true, dueDate: true, estimatedHours: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unestimatedTasks = incompleteTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? '',
      missingDueDate: !t.dueDate,
      missingEstimate: !t.estimatedHours,
    }));

    if (tasks.length === 0) {
      return successResponse({
        suggestions: [],
        unschedulable: [],
        totalFreeHours: 0,
        unestimatedCount: unestimatedTasks.length,
        unestimatedTasks,
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
    let calendarUnavailable = false;
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
    } catch (err) {
      console.warn('カレンダーイベント取得スキップ:', err);
      calendarUnavailable = true;
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

    return successResponse({
      ...result,
      unestimatedCount: unestimatedTasks.length,
      unestimatedTasks,
      calendarUnavailable,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Google')) {
      return errorResponse(error.message, 401);
    }
    return handleApiError(error);
  }
}
