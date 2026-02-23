import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, handleApiError } from '@/lib/api-utils';

const mappingSchema = z.object({
  googleTaskListId: z.string().min(1),
  googleTaskListName: z.string().min(1),
  projectId: z.string().min(1),
  workspaceId: z.string().min(1),
});

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const { googleTaskListId, googleTaskListName, projectId, workspaceId } =
      mappingSchema.parse(body);

    const mapping = await prisma.googleTaskListMapping.upsert({
      where: {
        userId_googleTaskListId: {
          userId: user.id,
          googleTaskListId,
        },
      },
      create: {
        userId: user.id,
        googleTaskListId,
        googleTaskListName,
        projectId,
        workspaceId,
      },
      update: {
        projectId,
        googleTaskListName,
        workspaceId,
      },
    });

    return successResponse(mapping);
  } catch (error) {
    return handleApiError(error);
  }
}
