import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGoogleClient, getCalendarClient } from '@/lib/google';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { GaxiosError } from 'googleapis-common';

const PRIORITY_COLOR_MAP: Record<string, number> = {
  P0: 11, // 赤
  P1: 5,  // 黄
  P2: 9,  // 青
  P3: 8,  // 灰
};

function formatDateForCalendar(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getGoogleApiErrorMessage(error: unknown): string {
  if (error instanceof GaxiosError) {
    const status = error.response?.status;
    const message = error.response?.data?.error?.message;
    if (status === 401) return 'Googleの認証が期限切れです。再ログインしてください';
    if (status === 403) return 'Googleカレンダーへのアクセス権限がありません';
    if (status === 404) return 'Googleカレンダーのイベントが見つかりません';
    if (message) return `Google APIエラー: ${message}`;
  }
  if (error instanceof Error && error.message === 'Googleアカウントが連携されていません') {
    return error.message;
  }
  return 'Googleカレンダーとの通信中にエラーが発生しました';
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
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
        dueDate: true,
        googleCalendarEventId: true,
      },
    });

    if (!task) return errorResponse('タスクが見つかりません', 404);
    if (!task.dueDate) return errorResponse('期限日を設定してからカレンダー同期を行ってください', 400);

    const auth = await getGoogleClient(user.id).catch((err) => {
      throw new Error(getGoogleApiErrorMessage(err));
    });
    const calendar = getCalendarClient(auth);

    const dateStr = formatDateForCalendar(task.dueDate);
    const nextDateStr = formatDateForCalendar(
      new Date(task.dueDate.getTime() + 24 * 60 * 60 * 1000)
    );
    const colorId = String(PRIORITY_COLOR_MAP[task.priority] ?? 8);

    const eventBody = {
      summary: task.title,
      description: task.description ?? undefined,
      start: { date: dateStr },
      end: { date: nextDateStr },
      colorId,
    };

    let googleEventId = task.googleCalendarEventId;

    if (googleEventId) {
      try {
        await calendar.events.patch({
          calendarId: 'primary',
          eventId: googleEventId,
          requestBody: eventBody,
        });
      } catch (err) {
        const status = err instanceof GaxiosError ? err.response?.status : 0;
        if (status === 404 || status === 410) {
          // イベントが削除されていた場合は新規作成
          const inserted = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: eventBody,
          });
          googleEventId = inserted.data.id ?? null;
        } else {
          throw new Error(getGoogleApiErrorMessage(err));
        }
      }
    } else {
      const inserted = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventBody,
      });
      googleEventId = inserted.data.id ?? null;
    }

    if (!googleEventId) return errorResponse('イベントIDの取得に失敗しました', 500);

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        googleCalendarEventId: googleEventId,
        googleCalendarSyncedAt: new Date(),
      },
      select: {
        id: true,
        googleCalendarEventId: true,
        googleCalendarSyncedAt: true,
      },
    });

    return successResponse(updated);
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
        project: {
          workspace: {
            members: { some: { userId: user.id, role: { not: 'VIEWER' } } },
          },
        },
      },
      select: {
        id: true,
        googleCalendarEventId: true,
      },
    });

    if (!task) return errorResponse('タスクが見つかりません', 404);
    if (!task.googleCalendarEventId) return errorResponse('カレンダーと連携されていません', 400);

    const auth = await getGoogleClient(user.id).catch((err) => {
      throw new Error(getGoogleApiErrorMessage(err));
    });
    const calendar = getCalendarClient(auth);

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: task.googleCalendarEventId,
      });
    } catch (err) {
      const delStatus = err instanceof GaxiosError ? err.response?.status : 0;
      if (!(delStatus === 404 || delStatus === 410)) {
        throw new Error(getGoogleApiErrorMessage(err));
      }
      // 既に削除済みの場合はそのまま続行
    }

    await prisma.task.update({
      where: { id: params.id },
      data: {
        googleCalendarEventId: null,
        googleCalendarSyncedAt: null,
      },
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
