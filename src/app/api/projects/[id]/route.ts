import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateProjectSchema } from '@/lib/validations/project';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { canAccessProject } from '@/lib/project-access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    if (!(await canAccessProject(user.id, params.id))) {
      return errorResponse('プロジェクトへのアクセス権がありません', 403);
    }
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspace: { members: { some: { userId: user.id } } },
      },
      include: {
        sections: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              where: { parentId: null },
              orderBy: { position: 'asc' },
              include: {
                assignees: {
                  include: { user: { select: { id: true, name: true, image: true } } },
                },
                labels: { include: { label: true } },
                _count: { select: { subtasks: true } },
              },
            },
          },
        },
      },
    });

    if (!project) return errorResponse('プロジェクトが見つかりません', 404);
    return successResponse(project);
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
    const body = await req.json();
    const data = updateProjectSchema.parse(body);
    const existing = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspace: { members: { some: { userId: user.id } } },
      },
    });
    if (!existing) return errorResponse('プロジェクトが見つかりません', 404);
    const project = await prisma.project.update({
      where: { id: params.id },
      data,
    });
    return successResponse(project);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    if (!(await canAccessProject(user.id, params.id))) {
      return errorResponse('プロジェクトへのアクセス権がありません', 403);
    }
    const existing = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspace: { members: { some: { userId: user.id } } },
      },
    });
    if (!existing) return errorResponse('プロジェクトが見つかりません', 404);
    await prisma.project.delete({ where: { id: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
