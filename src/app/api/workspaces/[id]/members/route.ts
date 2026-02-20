import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const inviteSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!membership) return errorResponse('アクセス権がありません', 403);

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: params.id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return successResponse(members);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) return errorResponse('OWNER/ADMINのみメンバーを追加できます', 403);

    const body = await req.json();
    const { email, role } = inviteSchema.parse(body);

    let targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      targetUser = await prisma.user.create({
        data: { email, name: email.split('@')[0] },
      });
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: targetUser.id },
    });
    if (existing) return errorResponse('すでにメンバーです', 409);

    const member = await prisma.workspaceMember.create({
      data: { workspaceId: params.id, userId: targetUser.id, role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return successResponse(member, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
