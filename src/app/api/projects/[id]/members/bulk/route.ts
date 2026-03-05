import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const bulkSchema = z.object({ userIds: z.array(z.string()).min(1) });

async function checkAdminAccess(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspace: { members: { some: { userId } } },
    },
    select: { workspaceId: true },
  });
  if (!project) return null;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: project.workspaceId, userId, role: { in: ['OWNER', 'ADMIN'] } },
  });
  if (!membership) return null;

  return project;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const project = await checkAdminAccess(user.id, params.id);
    if (!project) return errorResponse('権限がありません', 403);

    const { userIds } = bulkSchema.parse(await req.json());

    // Verify all users are workspace members
    const wsMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: project.workspaceId, userId: { in: userIds } },
      select: { userId: true },
    });
    const validUserIds = new Set(wsMembers.map((m) => m.userId));

    // Filter out already existing project members
    const existing = await prisma.projectMember.findMany({
      where: { projectId: params.id, userId: { in: userIds } },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((m) => m.userId));

    const toAdd = userIds.filter((id) => validUserIds.has(id) && !existingIds.has(id));

    if (toAdd.length > 0) {
      await prisma.projectMember.createMany({
        data: toAdd.map((userId) => ({ projectId: params.id, userId })),
      });
    }

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const project = await checkAdminAccess(user.id, params.id);
    if (!project) return errorResponse('権限がありません', 403);

    const { userIds } = bulkSchema.parse(await req.json());

    await prisma.projectMember.deleteMany({
      where: { projectId: params.id, userId: { in: userIds } },
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
