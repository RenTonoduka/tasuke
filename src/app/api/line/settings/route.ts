import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const user = await requireAuthUser();

    const lineAccount = await prisma.account.findFirst({
      where: { userId: user.id, provider: 'line' },
      select: { providerAccountId: true },
    });

    const mapping = lineAccount
      ? await prisma.lineUserMapping.findUnique({
          where: { lineUserId: lineAccount.providerAccountId },
          select: { displayName: true, isFollowing: true, reminderEnabled: true, createdAt: true },
        })
      : null;

    return NextResponse.json({
      connected: !!lineAccount,
      lineUserId: lineAccount?.providerAccountId ?? null,
      mapping,
    });
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();

    const lineAccount = await prisma.account.findFirst({
      where: { userId: user.id, provider: 'line' },
      select: { providerAccountId: true },
    });

    if (!lineAccount) {
      return NextResponse.json({ error: 'LINE未連携' }, { status: 400 });
    }

    const updated = await prisma.lineUserMapping.update({
      where: { lineUserId: lineAccount.providerAccountId },
      data: {
        reminderEnabled: typeof body.reminderEnabled === 'boolean' ? body.reminderEnabled : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireAuthUser();

    const lineAccount = await prisma.account.findFirst({
      where: { userId: user.id, provider: 'line' },
      select: { id: true, providerAccountId: true },
    });

    if (!lineAccount) {
      return NextResponse.json({ error: 'LINE未連携' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.lineUserMapping.delete({ where: { lineUserId: lineAccount.providerAccountId } }),
      prisma.account.delete({ where: { id: lineAccount.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '解除に失敗しました' }, { status: 500 });
  }
}
