import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const updateRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const user = await requireAuthUser();

    const myMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!myMembership) return errorResponse('権限がありません', 403);

    const target = await prisma.workspaceMember.findFirst({
      where: { id: params.memberId, workspaceId: params.id },
    });
    if (!target) return errorResponse('メンバーが見つかりません', 404);

    const body = await req.json();
    const { role } = updateRoleSchema.parse(body);

    // OWNERへの変更はOWNERのみ可
    if (role === 'OWNER' && myMembership.role !== 'OWNER') {
      return errorResponse('OWNERへの変更はOWNERのみ可能です', 403);
    }

    // ADMINはMEMBER/VIEWERのみ変更可
    if (myMembership.role === 'ADMIN' && !['MEMBER', 'VIEWER'].includes(role)) {
      return errorResponse('ADMINはMEMBER/VIEWERへの変更のみ可能です', 403);
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: params.memberId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const user = await requireAuthUser();

    const myMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!myMembership) return errorResponse('権限がありません', 403);

    const target = await prisma.workspaceMember.findFirst({
      where: { id: params.memberId, workspaceId: params.id },
    });
    if (!target) return errorResponse('メンバーが見つかりません', 404);

    if (target.role === 'OWNER') {
      return errorResponse('OWNERは削除できません', 403);
    }

    await prisma.workspaceMember.delete({ where: { id: params.memberId } });

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
