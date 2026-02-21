import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const settingsSchema = z.object({
  isPrivate: z.boolean(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

    // OWNER/ADMINのみ設定変更可能
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) return errorResponse('OWNER/ADMINのみ設定を変更できます', 403);

    const { isPrivate } = settingsSchema.parse(await req.json());

    // 公開→非公開に変更時: 全ワークスペースメンバーをProjectMemberに追加
    if (isPrivate && !project.isPrivate) {
      const wsMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: project.workspaceId },
        select: { userId: true },
      });
      const existingPMs = await prisma.projectMember.findMany({
        where: { projectId: params.id },
        select: { userId: true },
      });
      const existingIds = new Set(existingPMs.map((pm) => pm.userId));
      const toAdd = wsMembers.filter((m) => !existingIds.has(m.userId));

      if (toAdd.length > 0) {
        await prisma.projectMember.createMany({
          data: toAdd.map((m) => ({ projectId: params.id, userId: m.userId })),
        });
      }
    }

    const updated = await prisma.project.update({
      where: { id: params.id },
      data: { isPrivate },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
