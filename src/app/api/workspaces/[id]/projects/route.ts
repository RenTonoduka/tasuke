import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createProjectSchema } from '@/lib/validations/project';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);

    const projects = await prisma.project.findMany({
      where: { workspaceId: params.id },
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

    const body = await req.json();
    const data = createProjectSchema.parse(body);

    const maxPos = await prisma.project.aggregate({
      where: { workspaceId: params.id },
      _max: { position: true },
    });

    const project = await prisma.project.create({
      data: {
        ...data,
        workspaceId: params.id,
        position: (maxPos._max.position ?? 0) + 1,
        sections: {
          create: [
            { name: 'Todo', position: 0 },
            { name: '進行中', position: 1 },
            { name: '完了', position: 2 },
          ],
        },
      },
      include: { sections: { orderBy: { position: 'asc' } } },
    });

    return successResponse(project, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
