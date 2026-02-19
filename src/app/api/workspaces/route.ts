import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createWorkspaceSchema } from '@/lib/validations/workspace';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await requireAuthUser();
    const workspaces = await prisma.workspace.findMany({
      where: { members: { some: { userId: user.id } } },
      include: {
        members: { select: { id: true, role: true, userId: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return successResponse(workspaces);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const data = createWorkspaceSchema.parse(body);

    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30) + '-' + Date.now().toString(36);

    const workspace = await prisma.workspace.create({
      data: {
        name: data.name,
        slug,
        members: {
          create: { userId: user.id, role: 'OWNER' },
        },
      },
      include: { members: true },
    });

    return successResponse(workspace, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
