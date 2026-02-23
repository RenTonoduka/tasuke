import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { getGoogleClient, getCalendarClient } from '@/lib/google';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { GaxiosError } from 'googleapis-common';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');

    if (!timeMin || !timeMax) {
      return errorResponse('timeMin と timeMax は必須です', 400);
    }

    const auth = await getGoogleClient(user.id);
    const calendar = getCalendarClient(auth);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      timeZone: 'Asia/Tokyo',
      fields: 'items(id,summary,start,end,status,colorId)',
    });

    const events = (response.data.items ?? [])
      .filter((e) => e.status !== 'cancelled')
      .map((e) => {
        const allDay = !!e.start?.date;
        return {
          id: e.id,
          summary: e.summary ?? '(タイトルなし)',
          start: e.start?.dateTime ?? e.start?.date ?? '',
          end: e.end?.dateTime ?? e.end?.date ?? '',
          allDay,
          colorId: e.colorId ?? null,
        };
      });

    return successResponse(events);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Google')) {
      return errorResponse(error.message, 401);
    }
    return handleApiError(error);
  }
}

// DELETE: Googleカレンダーイベントを削除
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { eventId } = await req.json();

    if (!eventId) {
      return errorResponse('eventId は必須です', 400);
    }

    const auth = await getGoogleClient(user.id);
    const calendar = getCalendarClient(auth);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof GaxiosError) {
      const status = error.response?.status;
      if (status === 404 || status === 410) {
        return successResponse({ success: true });
      }
    }
    if (error instanceof Error && error.message.includes('Google')) {
      return errorResponse(error.message, 401);
    }
    return handleApiError(error);
  }
}

// PATCH: Googleカレンダーイベントの時間を更新
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { eventId, start, end } = await req.json();

    if (!eventId || !start || !end) {
      return errorResponse('eventId, start, end は必須です', 400);
    }

    const auth = await getGoogleClient(user.id);
    const calendar = getCalendarClient(auth);

    const updated = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        start: { dateTime: start, timeZone: 'Asia/Tokyo' },
        end: { dateTime: end, timeZone: 'Asia/Tokyo' },
      },
    });

    return successResponse({
      id: updated.data.id,
      summary: updated.data.summary ?? '(タイトルなし)',
      start: updated.data.start?.dateTime ?? '',
      end: updated.data.end?.dateTime ?? '',
    });
  } catch (error) {
    if (error instanceof GaxiosError) {
      const status = error.response?.status;
      if (status === 404 || status === 410) {
        return errorResponse('イベントが見つかりません', 404);
      }
    }
    if (error instanceof Error && error.message.includes('Google')) {
      return errorResponse(error.message, 401);
    }
    return handleApiError(error);
  }
}
