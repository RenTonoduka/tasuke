import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6B7280'),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!member) return errorResponse('アクセス権限がありません', 403);

    const groups = await prisma.projectGroup.findMany({
      where: { workspaceId: params.id },
      orderBy: { position: 'asc' },
      include: {
        projects: {
          orderBy: { position: 'asc' },
          select: { id: true, name: true, color: true, isPrivate: true, position: true },
        },
      },
    });
    return successResponse(groups);
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
    if (member.role === 'VIEWER') return errorResponse('閲覧者はグループを作成できません', 403);

    const body = await req.json();
    const data = createGroupSchema.parse(body);

    const maxPos = await prisma.projectGroup.aggregate({
      where: { workspaceId: params.id },
      _max: { position: true },
    });

    const group = await prisma.projectGroup.create({
      data: {
        ...data,
        workspaceId: params.id,
        position: (maxPos._max.position ?? 0) + 1,
      },
    });

    return successResponse(group, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
