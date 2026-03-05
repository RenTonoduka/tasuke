import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

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
      return errorResponse('PNG, JPG, SVG, WebP形式のみ対応しています', 400);
    }

    if (file.size > MAX_SIZE) {
      return errorResponse('ファイルサイズは2MB以下にしてください', 400);
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    await prisma.workspace.update({
      where: { id: params.id },
      data: { logoUrl: dataUrl },
    });

    return successResponse({ logoUrl: dataUrl });
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

    await prisma.workspace.update({
      where: { id: params.id },
      data: { logoUrl: null },
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
