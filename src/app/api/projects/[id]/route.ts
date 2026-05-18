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

    const existing = await prisma.project.findUnique({
      where: { id: params.id },
      select: { workspaceId: true },
    });
    if (!existing) return errorResponse('プロジェクトが見つかりません', 404);

    const currentMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: existing.workspaceId, userId: user.id },
      select: { role: true },
    });
    if (currentMembership?.role === 'VIEWER') {
      return errorResponse('閲覧者はプロジェクトを編集できません', 403);
    }

    const body = await req.json();
    const data = updateProjectSchema.parse(body);
    const updateData: Record<string, unknown> = { ...data };

    // groupId は null も許可（グループから外す）
    if ('groupId' in data) {
      updateData.groupId = data.groupId ?? null;
    }

    // ワークスペース間移動: 現 WS で OWNER/ADMIN ロール必須、移動先でも OWNER/ADMIN
    if (data.workspaceId) {
      if (data.workspaceId === existing.workspaceId) {
        delete updateData.workspaceId;
      } else {
        if (currentMembership?.role !== 'OWNER' && currentMembership?.role !== 'ADMIN') {
          return errorResponse('プロジェクトのワークスペース移動には現ワークスペースの管理者権限が必要です', 403);
        }
        const targetMember = await prisma.workspaceMember.findFirst({
          where: { workspaceId: data.workspaceId, userId: user.id },
          select: { role: true },
        });
        if (!targetMember) return errorResponse('移動先ワークスペースへのアクセス権がありません', 403);
        if (targetMember.role !== 'OWNER' && targetMember.role !== 'ADMIN') {
          return errorResponse('移動先ワークスペースで管理者権限が必要です', 403);
        }
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

    // VIEWER は削除不可、OWNER/ADMIN または PrivateProject の ProjectMember のみ
    const existing = await prisma.project.findUnique({
      where: { id: params.id },
      select: { workspaceId: true },
    });
    if (!existing) return errorResponse('プロジェクトが見つかりません', 404);
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: existing.workspaceId, userId: user.id },
      select: { role: true },
    });
    if (membership?.role !== 'OWNER' && membership?.role !== 'ADMIN') {
      return errorResponse('プロジェクトの削除には管理者権限が必要です', 403);
    }

    await prisma.project.delete({ where: { id: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
