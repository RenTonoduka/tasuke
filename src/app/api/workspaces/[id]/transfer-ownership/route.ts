import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const transferSchema = z.object({
  toMemberId: z.string().min(1),
});

/**
 * ワークスペースのオーナー権限を移譲する。
 * 現OWNERのみ実行可能。
 * 動作:
 *   1. 現OWNER (実行者) → ADMIN へ降格
 *   2. 指定 memberId → OWNER へ昇格
 *   両方をトランザクションで実行
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const { toMemberId } = transferSchema.parse(body);

    // 自分のメンバーシップ取得 + OWNERか確認
    const myMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.id, userId: user.id },
    });
    if (!myMembership) return errorResponse('ワークスペースへのアクセス権がありません', 403);
    if (myMembership.role !== 'OWNER') return errorResponse('OWNERのみがオーナー権限を移譲できます', 403);

    // 移譲先メンバー取得
    const target = await prisma.workspaceMember.findFirst({
      where: { id: toMemberId, workspaceId: params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!target) return errorResponse('移譲先メンバーが見つかりません', 404);
    if (target.id === myMembership.id) return errorResponse('自分自身に移譲することはできません', 400);
    if (target.role === 'OWNER') return errorResponse('既にOWNERです', 400);

    // 両方を1トランザクションで更新
    const [demoted, promoted] = await prisma.$transaction([
      prisma.workspaceMember.update({
        where: { id: myMembership.id },
        data: { role: 'ADMIN' },
      }),
      prisma.workspaceMember.update({
        where: { id: target.id },
        data: { role: 'OWNER' },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      }),
    ]);

    return successResponse({
      transferred: true,
      newOwner: {
        memberId: promoted.id,
        userId: promoted.userId,
        name: promoted.user.name,
        email: promoted.user.email,
      },
      previousOwner: {
        memberId: demoted.id,
        userId: demoted.userId,
        newRole: 'ADMIN',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
