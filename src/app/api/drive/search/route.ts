import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import { getGoogleClient, getDriveClient } from '@/lib/google';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const searchSchema = z.object({
  q: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\u3000-\u9FFF\u30A0-\u30FF\u3040-\u309F\uFF00-\uFFEF\s._-]*$/),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const rawQ = req.nextUrl.searchParams.get('q') ?? '';

    let auth;
    try {
      auth = await getGoogleClient(user.id);
    } catch {
      return errorResponse('Googleアカウントが連携されていません', 400);
    }

    const drive = getDriveClient(auth);
    const queryParts = ["trashed = false"];

    if (rawQ.trim()) {
      const parsed = searchSchema.safeParse({ q: rawQ.trim() });
      if (!parsed.success) {
        return errorResponse('検索キーワードに使用できない文字が含まれています', 400);
      }
      const q = parsed.data.q;
      const sanitized = q.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      queryParts.push(`name contains '${sanitized}'`);
    }

    let res;
    try {
      res = await drive.files.list({
        q: queryParts.join(' and '),
        pageSize: 20,
        fields: 'files(id,name,mimeType,webViewLink,iconLink,size,modifiedTime)',
        orderBy: 'modifiedTime desc',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Drive search error:', e);
      if (msg.includes('403') || msg.includes('insufficient')) {
        return errorResponse('Googleドライブへのアクセス権限がありません。再ログインしてください', 403);
      }
      return errorResponse('Googleドライブの検索に失敗しました', 500);
    }

    const files = (res.data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink,
      iconLink: f.iconLink,
      size: f.size ? parseInt(f.size, 10) : null,
      modifiedTime: f.modifiedTime,
    }));

    return successResponse(files);
  } catch (error) {
    return handleApiError(error);
  }
}
