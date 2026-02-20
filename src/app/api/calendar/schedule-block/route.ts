import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGoogleClient, getCalendarClient } from '@/lib/google';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { GaxiosError } from 'googleapis-common';

const PRIORITY_COLOR_MAP: Record<string, number> = {
  P0: 11,
  P1: 5,
  P2: 9,
  P3: 8,
};

function getGoogleApiErrorMessage(error: unknown): string {
  if (error instanceof GaxiosError) {
    const status = error.response?.status;
    const message = error.response?.data?.error?.message;
    if (status === 401) return 'Googleの認証が期限切れです。再ログインしてください';
    if (status === 403) return 'Googleカレンダーへのアクセス権限がありません';
    if (message) return `Google APIエラー: ${message}`;
  }
  if (error instanceof Error && error.message === 'Googleアカウントが連携されていません') {
    return error.message;
  }
  return 'Googleカレンダーとの通信中にエラーが発生しました';
}

// GET: 登録済みブロック取得
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const taskIds = req.nextUrl.searchParams.get('taskIds');

    if (!taskIds) return successResponse([]);

    const ids = taskIds.split(',').filter(Boolean);
    if (ids.length === 0) return successResponse([]);

    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        taskId: { in: ids },
        task: {
          project: {
            workspace: {
              members: { some: { userId: user.id } },
            },
          },
        },
      },
    });

    return successResponse(blocks);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST: スロットをGoogleカレンダーに登録
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { taskId, date, start, end } = await req.json();

    if (!taskId || !date || !start || !end) {
      return errorResponse('taskId, date, start, end は必須です');
    }

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: {
          workspace: {
            members: { some: { userId: user.id, role: { not: 'VIEWER' } } },
          },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
      },
    });

    if (!task) return errorResponse('タスクが見つかりません', 404);

    // 既存ブロックチェック（冪等性）
    const existing = await prisma.scheduleBlock.findUnique({
      where: {
        taskId_date_startTime: { taskId, date, startTime: start },
      },
    });
    if (existing) return successResponse(existing);

    // Google Calendar に時間ブロック作成
    const auth = await getGoogleClient(user.id).catch((err) => {
      throw new Error(getGoogleApiErrorMessage(err));
    });
    const calendar = getCalendarClient(auth);
    const colorId = String(PRIORITY_COLOR_MAP[task.priority] ?? 8);

    const inserted = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `[tasuke] ${task.title}`,
        description: task.description ?? undefined,
        start: { dateTime: `${date}T${start}:00`, timeZone: 'Asia/Tokyo' },
        end: { dateTime: `${date}T${end}:00`, timeZone: 'Asia/Tokyo' },
        colorId,
      },
    });

    const googleEventId = inserted.data.id;
    if (!googleEventId) return errorResponse('イベントIDの取得に失敗しました', 500);

    const block = await prisma.scheduleBlock.create({
      data: {
        taskId,
        googleCalendarEventId: googleEventId,
        date,
        startTime: start,
        endTime: end,
      },
    });

    return successResponse(block, 201);
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Google') ||
      error.message.includes('認証') ||
      error.message.includes('アクセス権限')
    )) {
      return errorResponse(error.message, 400);
    }
    return handleApiError(error);
  }
}

// DELETE: カレンダーから時間ブロックを削除
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { scheduleBlockId } = await req.json();

    if (!scheduleBlockId) return errorResponse('scheduleBlockId は必須です');

    const block = await prisma.scheduleBlock.findFirst({
      where: {
        id: scheduleBlockId,
        task: {
          project: {
            workspace: {
              members: { some: { userId: user.id, role: { not: 'VIEWER' } } },
            },
          },
        },
      },
    });

    if (!block) return errorResponse('ブロックが見つかりません', 404);

    // Google Calendar からイベント削除
    const auth = await getGoogleClient(user.id).catch((err) => {
      throw new Error(getGoogleApiErrorMessage(err));
    });
    const calendar = getCalendarClient(auth);

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: block.googleCalendarEventId,
      });
    } catch (err) {
      const status = err instanceof GaxiosError ? err.response?.status : 0;
      if (!(status === 404 || status === 410)) {
        throw new Error(getGoogleApiErrorMessage(err));
      }
    }

    await prisma.scheduleBlock.delete({
      where: { id: scheduleBlockId },
    });

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Google') ||
      error.message.includes('認証') ||
      error.message.includes('アクセス権限')
    )) {
      return errorResponse(error.message, 400);
    }
    return handleApiError(error);
  }
}
