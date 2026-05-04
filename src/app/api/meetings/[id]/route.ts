import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, handleApiError, errorResponse } from '@/lib/api-utils';
import { assertMeetingAccess } from '@/lib/meeting/access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    await assertMeetingAccess(user.id, params.id);

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: {
        extractedTasks: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!meeting) return errorResponse('議事録が見つかりません', 404);

    // 関連するプロジェクト・メンバーを編集UIで使うので一緒に返す
    const [projects, members] = await Promise.all([
      prisma.project.findMany({
        where: { workspaceId: meeting.workspaceId },
        select: {
          id: true,
          name: true,
          color: true,
          sections: { select: { id: true, name: true }, orderBy: { position: 'asc' } },
        },
        orderBy: { position: 'asc' },
      }),
      prisma.workspaceMember.findMany({
        where: { workspaceId: meeting.workspaceId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      }),
    ]);

    return successResponse({
      meeting,
      projects,
      members: members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    await assertMeetingAccess(user.id, params.id);
    await prisma.meeting.delete({ where: { id: params.id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
