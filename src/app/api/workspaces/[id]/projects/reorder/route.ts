import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const reorderSchema = z.object({
  projectIds: z.array(z.string()).min(1),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はプロジェクトを並べ替えできません', 403);

    const body = await req.json();
    const { projectIds } = reorderSchema.parse(body);

    await prisma.$transaction(
      projectIds.map((id, index) =>
        prisma.project.update({
          where: { id, workspaceId: params.id },
          data: { position: index },
        })
      )
    );

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
