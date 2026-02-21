import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getGoogleErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const err = error as { response?: { status?: number; data?: { error?: { message?: string } } }; code?: number };
  const status = err.response?.status ?? err.code;
  if (!status) return null;
  const detail = err.response?.data?.error?.message;
  if (status === 401) return 'Googleの認証が期限切れです。再ログインしてください';
  if (status === 403) return 'Googleへのアクセス権限がありません。再ログインしてください';
  if (status === 404 || status === 410) return 'Googleリソースが見つかりません';
  if (status === 429) return 'Google APIのリクエスト制限に達しました。しばらく待ってから再試行してください';
  if (detail) return `Google APIエラー: ${detail}`;
  if (status >= 500) return 'Googleサーバーで一時的なエラーが発生しています';
  return null;
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return errorResponse(error.issues[0]?.message ?? 'バリデーションエラー', 400);
  }
  if (error instanceof Error && error.message === '認証が必要です') {
    return errorResponse('認証が必要です', 401);
  }
  // Google API エラー
  const googleMsg = getGoogleErrorMessage(error);
  if (googleMsg) {
    console.error('[Google API]', error);
    return errorResponse(googleMsg, 502);
  }
  if (error instanceof Error && (
    error.message.includes('Google') ||
    error.message.includes('認証') ||
    error.message.includes('アクセス権限')
  )) {
    return errorResponse(error.message, 400);
  }
  console.error(error);
  return errorResponse('内部エラーが発生しました', 500);
}
