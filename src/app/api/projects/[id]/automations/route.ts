import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { createRuleSchema } from '@/lib/validations/automation';

async function getMemberRole(projectId: string, userId: string) {
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const role = await getMemberRole(params.id, user.id);
    if (!role) return errorResponse('アクセス権がありません', 403);

    const rules = await prisma.automationRule.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: 'asc' },
    });

    return successResponse(rules);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const role = await getMemberRole(params.id, user.id);
    if (!role) return errorResponse('アクセス権がありません', 403);
    if (role === 'VIEWER') return errorResponse('VIEWERはルールを作成できません', 403);

    const body = await req.json();
    const data = createRuleSchema.parse(body);

    const rule = await prisma.automationRule.create({
      data: {
        name: data.name,
        trigger: data.trigger,
        action: data.action,
        projectId: params.id,
        createdById: user.id,
      },
    });

    return successResponse(rule, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
