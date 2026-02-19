import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return errorResponse(error.issues[0]?.message ?? 'バリデーションエラー', 400);
  }
  console.error(error);
  return errorResponse('内部エラーが発生しました', 500);
}
