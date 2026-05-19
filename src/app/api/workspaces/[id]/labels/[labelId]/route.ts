import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const updateLabelSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; labelId: string } },
) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
      select: { role: true },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はラベルを編集できません', 403);

    const label = await prisma.label.findFirst({
      where: { id: params.labelId, workspaceId: params.id },
    });
    if (!label) return errorResponse('ラベルが見つかりません', 404);

    const body = await req.json();
    const data = updateLabelSchema.parse(body);

    const updated = await prisma.label.update({
      where: { id: params.labelId },
      data,
    });
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; labelId: string } },
) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
      select: { role: true },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はラベルを削除できません', 403);

    const label = await prisma.label.findFirst({
      where: { id: params.labelId, workspaceId: params.id },
    });
    if (!label) return errorResponse('ラベルが見つかりません', 404);

    // TaskLabel は onDelete: Cascade で自動削除される
    await prisma.label.delete({ where: { id: params.labelId } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
