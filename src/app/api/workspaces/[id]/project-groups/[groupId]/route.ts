import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; groupId: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はグループを編集できません', 403);

    const body = await req.json();
    const data = updateGroupSchema.parse(body);

    const group = await prisma.projectGroup.update({
      where: { id: params.groupId },
      data,
    });
    return successResponse(group);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; groupId: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はグループを削除できません', 403);

    // グループ内プロジェクトの groupId を null にしてから削除
    await prisma.project.updateMany({
      where: { groupId: params.groupId },
      data: { groupId: null },
    });

    await prisma.projectGroup.delete({
      where: { id: params.groupId },
    });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
