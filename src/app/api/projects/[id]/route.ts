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
    const updateData: Record<string, unknown> = { ...data };

    // groupId は null も許可（グループから外す）
    if ('groupId' in data) {
      updateData.groupId = data.groupId ?? null;
    }

    // ワークスペース間移動
    if (data.workspaceId) {
      const existing = await prisma.project.findUnique({ where: { id: params.id } });
      if (existing && data.workspaceId === existing.workspaceId) {
        delete updateData.workspaceId;
      } else if (existing && data.workspaceId !== existing.workspaceId) {
        const isMember = await prisma.workspaceMember.findFirst({
          where: { workspaceId: data.workspaceId, userId: user.id },
        });
        if (!isMember) return errorResponse('移動先ワークスペースへのアクセス権がありません', 403);
        const maxPos = await prisma.project.aggregate({
          where: { workspaceId: data.workspaceId },
          _max: { position: true },
        });
        updateData.position = (maxPos._max.position ?? 0) + 1;
      }
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
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
    await prisma.project.delete({ where: { id: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
