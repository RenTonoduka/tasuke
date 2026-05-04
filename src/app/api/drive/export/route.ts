import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import { getGoogleClient, getDriveClient } from '@/lib/google';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export const maxDuration = 30;

const querySchema = z.object({
  fileId: z.string().min(1).max(200),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const parsed = querySchema.safeParse({ fileId: req.nextUrl.searchParams.get('fileId') });
    if (!parsed.success) return errorResponse('fileIdが必要です');

    let auth;
    try {
      auth = await getGoogleClient(user.id);
    } catch {
      return errorResponse('Googleアカウントが連携されていません', 400);
    }

    const drive = getDriveClient(auth);

    // メタデータ取得（タイトル・mimeType）
    const meta = await drive.files.get({
      fileId: parsed.data.fileId,
      fields: 'id,name,mimeType,webViewLink',
    });

    if (meta.data.mimeType !== 'application/vnd.google-apps.document') {
      return errorResponse('Googleドキュメント以外は取込対象外です', 400);
    }

    // text/plain でエクスポート
    const exportRes = await drive.files.export(
      { fileId: parsed.data.fileId, mimeType: 'text/plain' },
      { responseType: 'text' },
    );
    const transcript = String(exportRes.data ?? '');

    return successResponse({
      fileId: meta.data.id,
      name: meta.data.name,
      webViewLink: meta.data.webViewLink ?? null,
      transcript,
      length: transcript.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
