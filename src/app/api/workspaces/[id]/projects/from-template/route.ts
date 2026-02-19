import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const fromTemplateSchema = z.object({
  templateId: z.string().min(1, 'テンプレートIDは必須です'),
  name: z.string().min(1, 'プロジェクト名は必須です').max(100),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はプロジェクトを作成できません', 403);

    const body = await req.json();
    const data = fromTemplateSchema.parse(body);

    const template = await prisma.projectTemplate.findFirst({
      where: { id: data.templateId, workspaceId: params.id },
      include: { taskTemplates: { orderBy: { position: 'asc' } } },
    });
    if (!template) return errorResponse('テンプレートが見つかりません', 404);

    // ユニークなセクション名を抽出（順序を保持）
    const sectionNames: string[] = [];
    for (const tt of template.taskTemplates) {
      if (!sectionNames.includes(tt.section)) {
        sectionNames.push(tt.section);
      }
    }
    // テンプレートにタスクがない場合はデフォルトセクション
    if (sectionNames.length === 0) {
      sectionNames.push('Todo', '進行中', '完了');
    }

    const maxPos = await prisma.project.aggregate({
      where: { workspaceId: params.id },
      _max: { position: true },
    });

    // プロジェクトとセクションを作成
    const project = await prisma.project.create({
      data: {
        name: data.name,
        color: template.color,
        workspaceId: params.id,
        position: (maxPos._max.position ?? 0) + 1,
        sections: {
          create: sectionNames.map((name, index) => ({ name, position: index })),
        },
      },
      include: { sections: { orderBy: { position: 'asc' } } },
    });

    // セクション名→IDのマップ
    const sectionMap = new Map(project.sections.map((s) => [s.name, s.id]));

    // タスクテンプレートからタスクを一括作成
    if (template.taskTemplates.length > 0) {
      await prisma.task.createMany({
        data: template.taskTemplates.map((tt) => ({
          title: tt.title,
          description: tt.description ?? null,
          priority: tt.priority,
          position: tt.position,
          projectId: project.id,
          sectionId: sectionMap.get(tt.section) ?? project.sections[0]?.id ?? '',
          createdById: user.id,
        })),
      });
    }

    // タスクを含む完全なプロジェクトを返す
    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        sections: {
          orderBy: { position: 'asc' },
          include: { tasks: { where: { parentId: null }, orderBy: { position: 'asc' } } },
        },
      },
    });

    return successResponse(fullProject, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
