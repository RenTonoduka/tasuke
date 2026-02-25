import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, handleApiError } from '@/lib/api-utils';

const mappingSchema = z.object({
  githubRepoFullName: z.string().min(1),
  projectId: z.string().min(1),
  workspaceId: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireAuthUser();
    const mappings = await prisma.gitHubRepoMapping.findMany({
      where: { userId: user.id },
      include: { project: { select: { name: true, color: true } } },
    });
    return successResponse({ mappings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const { githubRepoFullName, projectId, workspaceId } = mappingSchema.parse(body);

    const mapping = await prisma.gitHubRepoMapping.upsert({
      where: {
        userId_githubRepoFullName: {
          userId: user.id,
          githubRepoFullName,
        },
      },
      create: { userId: user.id, githubRepoFullName, projectId, workspaceId },
      update: { projectId, workspaceId },
    });

    return successResponse(mapping);
  } catch (error) {
    return handleApiError(error);
  }
}
