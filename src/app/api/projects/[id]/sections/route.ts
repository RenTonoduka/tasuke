import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { canAccessProject } from '@/lib/project-access';

const createSectionSchema = z.object({
  name: z.string().min(1).max(50),
});

const reorderSchema = z.object({
  sections: z.array(z.object({
    id: z.string(),
    position: z.number(),
  })),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    if (!(await canAccessProject(user.id, params.id))) {
      return errorResponse('プロジェクトへのアクセス権がありません', 403);
    }
    const sections = await prisma.section.findMany({
      where: { projectId: params.id },
      orderBy: { position: 'asc' },
      include: { _count: { select: { tasks: true } } },
    });
    return successResponse(sections);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    if (!(await canAccessProject(user.id, params.id))) {
      return errorResponse('プロジェクトへのアクセス権がありません', 403);
    }

    // VIEWERチェック
    const project = await prisma.project.findUnique({ where: { id: params.id }, select: { workspaceId: true } });
    if (!project) return errorResponse('プロジェクトが見つかりません', 404);
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: user.id },
    });
    if (member?.role === 'VIEWER') return errorResponse('閲覧者はセクションを作成できません', 403);

    const body = await req.json();
    const data = createSectionSchema.parse(body);

    const maxPos = await prisma.section.aggregate({
      where: { projectId: params.id },
      _max: { position: true },
    });

    const section = await prisma.section.create({
      data: {
        name: data.name,
        projectId: params.id,
        position: (maxPos._max.position ?? 0) + 1,
      },
    });

    return successResponse(section, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    if (!(await canAccessProject(user.id, params.id))) {
      return errorResponse('プロジェクトへのアクセス権がありません', 403);
    }

    // VIEWERチェック
    const project = await prisma.project.findUnique({ where: { id: params.id }, select: { workspaceId: true } });
    if (!project) return errorResponse('プロジェクトが見つかりません', 404);
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: user.id },
    });
    if (member?.role === 'VIEWER') return errorResponse('閲覧者はセクションを編集できません', 403);

    const body = await req.json();
    const data = reorderSchema.parse(body);

    await prisma.$transaction(
      data.sections.map((s) =>
        prisma.section.update({
          where: { id: s.id },
          data: { position: s.position },
        })
      )
    );

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
