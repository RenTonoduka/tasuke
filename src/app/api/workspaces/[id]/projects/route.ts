import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createProjectSchema } from '@/lib/validations/project';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { getAccessibleProjectIds } from '@/lib/project-access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);

    const accessibleIds = await getAccessibleProjectIds(user.id, params.id);
    const projects = await prisma.project.findMany({
      where: { id: { in: accessibleIds } },
      include: {
        sections: { orderBy: { position: 'asc' } },
        _count: { select: { tasks: true } },
      },
      orderBy: { position: 'asc' },
    });
    return successResponse(projects);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);
    if (member.role === 'VIEWER') return errorResponse('閲覧者はプロジェクトを作成できません', 403);

    const body = await req.json();
    const data = createProjectSchema.parse(body);
    const groupId = typeof body.groupId === 'string' ? body.groupId : undefined;

    const maxPos = await prisma.project.aggregate({
      where: { workspaceId: params.id },
      _max: { position: true },
    });

    const project = await prisma.project.create({
      data: {
        ...data,
        workspaceId: params.id,
        position: (maxPos._max.position ?? 0) + 1,
        ...(groupId && { groupId }),
        sections: {
          create: [
            { name: 'Todo', position: 0, color: '#9AA0A6', statusMapping: 'TODO' },
            { name: '進行中', position: 1, color: '#4285F4', statusMapping: 'IN_PROGRESS' },
            { name: '完了', position: 2, color: '#34A853', statusMapping: 'DONE' },
          ],
        },
        ...(data.isPrivate && {
          members: {
            create: { userId: user.id },
          },
        }),
      },
      include: { sections: { orderBy: { position: 'asc' } } },
    });

    return successResponse(project, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
