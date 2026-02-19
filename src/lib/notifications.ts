import prisma from './prisma';

export async function createNotification(params: {
  userId: string;
  type: string;
  message: string;
  taskId?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      message: params.message,
      taskId: params.taskId,
    },
  });
}

export function extractMentions(content: string): string[] {
  const simple = content.match(/@(\S+)/g)?.map((m) => m.slice(1)) ?? [];
  return Array.from(new Set(simple));
}
