import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const saveAsTemplateSchema = z.object({
  name: z.string().min(1, 'テンプレート名は必須です').max(100),
  description: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspace: { members: { some: { userId: user.id } } },
      },
      include: {
        workspace: { include: { members: { where: { userId: user.id } } } },
        sections: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              where: { parentId: null },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!project) return errorResponse('プロジェクトが見つかりません', 404);

    const member = project.workspace.members[0];
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はテンプレートを作成できません', 403);

    const body = await req.json();
    const data = saveAsTemplateSchema.parse(body);

    // 全タスクをフラットに展開してTaskTemplateデータを構築
    const taskTemplateData = project.sections.flatMap((section) =>
      section.tasks.map((task) => ({
        title: task.title,
        description: task.description ?? undefined,
        priority: task.priority,
        section: section.name,
        position: task.position,
      }))
    );

    const template = await prisma.projectTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        color: project.color,
        workspaceId: project.workspaceId,
        taskTemplates: {
          create: taskTemplateData,
        },
      },
      include: { _count: { select: { taskTemplates: true } } },
    });

    return successResponse(template, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
