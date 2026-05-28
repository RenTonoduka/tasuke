import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
  | 'DUE_DATE_CHANGED'
  | 'TASK_REQUESTED'
  | 'TASK_ACCEPTED'
  | 'TASK_DECLINED'
  | 'TASK_SUBMITTED'
  | 'TASK_APPROVED'
  | 'TASK_SENT_BACK'
  | 'TASK_RETURNED'
  | 'REQUEST_CANCELLED';

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
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue,
    },
  });
}
