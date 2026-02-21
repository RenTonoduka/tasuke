import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const addMemberSchema = z.object({
  userId: z.string(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspace: { members: { some: { userId: user.id } } },
      },
      select: { id: true, isPrivate: true, workspaceId: true },
    });
    if (!project) return errorResponse('プロジェクトが見つかりません', 404);

    const members = await prisma.projectMember.findMany({
      where: { projectId: params.id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { addedAt: 'asc' },
    });

    return successResponse(members);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspace: { members: { some: { userId: user.id } } },
      },
      select: { workspaceId: true },
    });
    if (!project) return errorResponse('プロジェクトが見つかりません', 404);

    // OWNER/ADMINのみメンバー追加可能
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) return errorResponse('OWNER/ADMINのみメンバーを追加できます', 403);

    const { userId: targetUserId } = addMemberSchema.parse(await req.json());

    // ワークスペースメンバーか確認
    const wsMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: targetUserId },
    });
    if (!wsMember) return errorResponse('ワークスペースメンバーではありません', 400);

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: targetUserId } },
    });
    if (existing) return errorResponse('すでにプロジェクトメンバーです', 409);

    const member = await prisma.projectMember.create({
      data: { projectId: params.id, userId: targetUserId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return successResponse(member, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspace: { members: { some: { userId: user.id } } },
      },
      select: { workspaceId: true },
    });
    if (!project) return errorResponse('プロジェクトが見つかりません', 404);

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) return errorResponse('OWNER/ADMINのみメンバーを削除できます', 403);

    const { userId: targetUserId } = addMemberSchema.parse(await req.json());

    await prisma.projectMember.deleteMany({
      where: { projectId: params.id, userId: targetUserId },
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
