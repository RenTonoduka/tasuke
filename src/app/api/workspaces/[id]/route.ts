import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateWorkspaceSchema } from '@/lib/validations/workspace';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const workspace = await prisma.workspace.findFirst({
      where: { id: params.id, members: { some: { userId: user.id } } },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
        projects: { orderBy: { position: 'asc' } },
      },
    });

    if (!workspace) return errorResponse('ワークスペースが見つかりません', 404);
    return successResponse(workspace);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!member) return errorResponse('権限がありません', 403);

    const body = await req.json();
    const data = updateWorkspaceSchema.parse(body);
    const workspace = await prisma.workspace.update({
      where: { id: params.id },
      data,
    });
    return successResponse(workspace);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id, role: 'OWNER' },
    });
    if (!member) return errorResponse('オーナーのみ削除できます', 403);

    await prisma.workspace.delete({ where: { id: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
