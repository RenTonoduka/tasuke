import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGoogleClient, getTasksClient } from '@/lib/google';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function GET(
  _req: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const user = await requireAuthUser();
    const auth = await getGoogleClient(user.id);
    const tasksClient = getTasksClient(auth);

    const res = await tasksClient.tasks.list({
      tasklist: params.listId,
      maxResults: 100,
      showCompleted: false,
      showHidden: false,
    });
    const gTasks = res.data.items ?? [];

    const googleTaskIds = gTasks.map((t) => t.id!).filter(Boolean);
    const existingTasks = await prisma.task.findMany({
      where: { googleTaskId: { in: googleTaskIds } },
      select: { id: true, googleTaskId: true },
    });
    const existingMap = new Map(
      existingTasks.map((t) => [t.googleTaskId, t.id])
    );

    return successResponse({
      tasks: gTasks.map((t) => ({
        id: t.id,
        title: t.title,
        notes: t.notes ?? null,
        status: t.status,
        due: t.due ?? null,
        updated: t.updated,
        alreadyImported: existingMap.has(t.id!),
        tasukeTaskId: existingMap.get(t.id!) ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
