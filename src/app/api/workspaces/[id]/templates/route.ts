import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const taskTemplateSchema = z.object({
  title: z.string().min(1, 'タスク名は必須です').max(200),
  description: z.string().optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).default('P3'),
  section: z.string().min(1).max(100).default('Todo'),
  position: z.number().default(0),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, 'テンプレート名は必須です').max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4285F4'),
  taskTemplates: z.array(taskTemplateSchema).max(500).optional().default([]),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);

    const templates = await prisma.projectTemplate.findMany({
      where: { workspaceId: params.id },
      include: { _count: { select: { taskTemplates: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(templates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はテンプレートを作成できません', 403);

    const body = await req.json();
    const data = createTemplateSchema.parse(body);

    const template = await prisma.projectTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        workspaceId: params.id,
        taskTemplates: {
          create: data.taskTemplates.map((t) => ({
            title: t.title,
            description: t.description,
            priority: t.priority,
            section: t.section,
            position: t.position,
          })),
        },
      },
      include: { taskTemplates: { orderBy: { position: 'asc' } } },
    });

    return successResponse(template, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
