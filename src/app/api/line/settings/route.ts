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

    let mapping = lineAccount
      ? await prisma.lineUserMapping.findFirst({
          where: { userId: user.id },
          select: { id: true, displayName: true, isFollowing: true, reminderEnabled: true, linkingCode: true, createdAt: true },
        })
      : null;

    // linkingCodeが未生成なら自動生成
    if (mapping && !mapping.linkingCode) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      mapping = await prisma.lineUserMapping.update({
        where: { id: mapping.id },
        data: { linkingCode: code },
        select: { id: true, displayName: true, isFollowing: true, reminderEnabled: true, linkingCode: true, createdAt: true },
      });
    }

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

    const mapping = await prisma.lineUserMapping.findFirst({
      where: { userId: user.id },
    });

    if (!mapping) {
      return NextResponse.json({ error: 'LINE未連携' }, { status: 400 });
    }

    const updated = await prisma.lineUserMapping.update({
      where: { id: mapping.id },
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
      select: { id: true },
    });

    const mapping = await prisma.lineUserMapping.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    const ops = [];
    if (mapping) ops.push(prisma.lineUserMapping.delete({ where: { id: mapping.id } }));
    if (lineAccount) ops.push(prisma.account.delete({ where: { id: lineAccount.id } }));

    if (ops.length > 0) await prisma.$transaction(ops);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '解除に失敗しました' }, { status: 500 });
  }
}
