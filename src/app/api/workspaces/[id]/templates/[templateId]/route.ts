import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; templateId: string } }
) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);

    const template = await prisma.projectTemplate.findFirst({
      where: { id: params.templateId, workspaceId: params.id },
      include: { taskTemplates: { orderBy: { position: 'asc' } } },
    });
    if (!template) return errorResponse('テンプレートが見つかりません', 404);

    return successResponse(template);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; templateId: string } }
) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はテンプレートを削除できません', 403);

    const template = await prisma.projectTemplate.findFirst({
      where: { id: params.templateId, workspaceId: params.id },
    });
    if (!template) return errorResponse('テンプレートが見つかりません', 404);

    // 修正5: where条件にworkspaceIdを含めてTOCTOUを防ぐ
    await prisma.projectTemplate.delete({ where: { id: params.templateId, workspaceId: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
