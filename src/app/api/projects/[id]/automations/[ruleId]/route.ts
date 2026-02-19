import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { patchRuleSchema } from '@/lib/validations/automation';

async function checkAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project) return null;

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: project.workspaceId, userId },
  });
  return member?.role ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const user = await requireAuthUser();
    const role = await checkAccess(params.id, user.id);
    if (!role) return errorResponse('アクセス権がありません', 403);
    if (role === 'VIEWER') return errorResponse('VIEWERはルールを編集できません', 403);

    const existing = await prisma.automationRule.findFirst({
      where: { id: params.ruleId, projectId: params.id },
    });
    if (!existing) return errorResponse('ルールが見つかりません', 404);

    const body = await req.json();
    const data = patchRuleSchema.parse(body);

    const updateData: Prisma.AutomationRuleUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.trigger !== undefined) updateData.trigger = data.trigger as Prisma.InputJsonValue;
    if (data.action !== undefined) updateData.action = data.action as Prisma.InputJsonValue;

    // 修正5: where条件にprojectIdを含めてTOCTOUを防ぐ
    const rule = await prisma.automationRule.update({
      where: { id: params.ruleId, projectId: params.id },
      data: updateData,
    });

    return successResponse(rule);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const user = await requireAuthUser();
    const role = await checkAccess(params.id, user.id);
    if (!role) return errorResponse('アクセス権がありません', 403);
    if (role === 'VIEWER') return errorResponse('VIEWERはルールを削除できません', 403);

    const existing = await prisma.automationRule.findFirst({
      where: { id: params.ruleId, projectId: params.id },
    });
    if (!existing) return errorResponse('ルールが見つかりません', 404);

    // 修正5: where条件にprojectIdを含めてTOCTOUを防ぐ
    await prisma.automationRule.delete({ where: { id: params.ruleId, projectId: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
