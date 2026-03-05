import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { uploadToR2, deleteFromR2, getR2KeyFromUrl } from '@/lib/r2';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) return errorResponse('OWNER/ADMINのみ変更できます', 403);

    const formData = await req.formData();
    const file = formData.get('logo') as File | null;
    if (!file) return errorResponse('ファイルが必要です', 400);

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse('PNG, JPG, WebP形式のみ対応しています', 400);
    }

    if (file.size > MAX_SIZE) {
      return errorResponse('ファイルサイズは2MB以下にしてください', 400);
    }

    // 古いロゴがR2にあればbest-effortで削除
    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      select: { logoUrl: true },
    });
    if (workspace?.logoUrl) {
      const oldKey = getR2KeyFromUrl(workspace.logoUrl);
      if (oldKey) {
        deleteFromR2(oldKey).catch(() => {});
      }
    }

    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const key = `workspace-logos/${params.id}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const logoUrl = await uploadToR2(key, buffer, file.type);

    await prisma.workspace.update({
      where: { id: params.id },
      data: { logoUrl },
    });

    return successResponse({ logoUrl });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) return errorResponse('OWNER/ADMINのみ変更できます', 403);

    // R2オブジェクトをbest-effortで削除
    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      select: { logoUrl: true },
    });
    if (workspace?.logoUrl) {
      const key = getR2KeyFromUrl(workspace.logoUrl);
      if (key) {
        deleteFromR2(key).catch(() => {});
      }
    }

    await prisma.workspace.update({
      where: { id: params.id },
      data: { logoUrl: null },
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
