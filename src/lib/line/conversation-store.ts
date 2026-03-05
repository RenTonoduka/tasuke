import prisma from '@/lib/prisma';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const HISTORY_LIMIT = 10;
const HISTORY_TTL_MINUTES = 30;

export async function loadConversationHistory(
  lineUserId: string,
): Promise<ConversationMessage[]> {
  const cutoff = new Date(Date.now() - HISTORY_TTL_MINUTES * 60 * 1000);

  const records = await prisma.lineConversation.findMany({
    where: {
      lineUserId,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: 'asc' },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });

  return records.map(r => ({
    role: r.role as 'user' | 'assistant',
    content: r.content,
  }));
}

export async function saveConversationTurn(
  lineUserId: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  await prisma.lineConversation.createMany({
    data: [
      { lineUserId, role: 'user', content: userMessage },
      { lineUserId, role: 'assistant', content: assistantReply },
    ],
  });

  // 1時間超の古い履歴を削除
  const oldCutoff = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.lineConversation.deleteMany({
    where: {
      lineUserId,
      createdAt: { lt: oldCutoff },
    },
  });
}
