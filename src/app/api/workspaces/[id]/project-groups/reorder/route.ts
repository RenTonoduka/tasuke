import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const reorderSchema = z.object({
  groupIds: z.array(z.string()),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);

    const body = await req.json();
    const { groupIds } = reorderSchema.parse(body);

    await prisma.$transaction(
      groupIds.map((id, index) =>
        prisma.projectGroup.update({
          where: { id },
          data: { position: index },
        })
      )
    );

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
