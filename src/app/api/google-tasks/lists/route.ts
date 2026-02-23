import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGoogleClient, getTasksClient } from '@/lib/google';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await requireAuthUser();
    const auth = await getGoogleClient(user.id);
    const tasksClient = getTasksClient(auth);

    const res = await tasksClient.tasklists.list({ maxResults: 100 });
    const lists = res.data.items ?? [];

    const mappings = await prisma.googleTaskListMapping.findMany({
      where: { userId: user.id },
    });
    const mappingMap = new Map(
      mappings.map((m) => [m.googleTaskListId, { projectId: m.projectId, workspaceId: m.workspaceId }])
    );

    return successResponse({
      lists: lists.map((l) => ({
        id: l.id,
        title: l.title,
        updated: l.updated,
        mappedProjectId: mappingMap.get(l.id!)?.projectId ?? null,
        mappedWorkspaceId: mappingMap.get(l.id!)?.workspaceId ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
