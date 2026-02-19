import prisma from '@/lib/prisma';

type ActivityType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'TASK_REOPENED'
  | 'TASK_MOVED'
  | 'COMMENT_ADDED'
  | 'ASSIGNEE_ADDED'
  | 'ASSIGNEE_REMOVED'
  | 'LABEL_ADDED'
  | 'LABEL_REMOVED'
  | 'PRIORITY_CHANGED'
  | 'DUE_DATE_CHANGED';

export async function logActivity(params: {
  type: ActivityType;
  userId: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.activity.create({
    data: {
      type: params.type,
      userId: params.userId,
      taskId: params.taskId,
      // Prisma の InputJsonValue に合わせて as any でキャスト
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: (params.metadata ?? undefined) as any,
    },
  });
}
