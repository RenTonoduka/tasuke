import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const triggerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('STATUS_CHANGE'),
    from: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional(),
    to: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']),
  }),
  z.object({
    type: z.literal('PRIORITY_CHANGE'),
    to: z.enum(['P0', 'P1', 'P2', 'P3']),
  }),
  z.object({
    type: z.literal('DUE_DATE_APPROACHING'),
    daysBefore: z.number().int().min(1).max(30),
  }),
]);

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NOTIFY_ASSIGNEES'), message: z.string().max(200).optional() }),
  z.object({ type: z.literal('SET_PRIORITY'), priority: z.enum(['P0', 'P1', 'P2', 'P3']) }),
  z.object({ type: z.literal('MOVE_SECTION'), sectionName: z.string().min(1).max(100) }),
  z.object({ type: z.literal('ADD_LABEL'), labelName: z.string().min(1).max(50) }),
]);

const createRuleSchema = z.object({
  name: z.string().min(1, 'ルール名は必須です').max(100),
  trigger: triggerSchema,
  action: actionSchema,
});

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
