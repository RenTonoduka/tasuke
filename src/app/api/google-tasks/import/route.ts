import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const importSchema = z.object({
  tasks: z
    .array(
      z.object({
        googleTaskId: z.string().min(1),
        googleTaskListId: z.string().min(1),
        title: z.string().min(1).max(200),
        description: z.string().max(5000).optional().nullable(),
        dueDate: z.string().optional().nullable(),
      })
    )
    .min(1)
    .max(50),
  projectId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const { tasks, projectId, sectionId } = importSchema.parse(body);

    if (!(await canAccessProject(user.id, projectId))) {
      return errorResponse('プロジェクトへのアクセス権がありません', 403);
    }

    // 重複チェック
    const googleTaskIds = tasks.map((t) => t.googleTaskId);
    const existing = await prisma.task.findMany({
      where: { googleTaskId: { in: googleTaskIds } },
      select: { googleTaskId: true },
    });
    const existingSet = new Set(existing.map((t) => t.googleTaskId));
    const toImport = tasks.filter((t) => !existingSet.has(t.googleTaskId));
    const skipped = tasks.length - toImport.length;

    // position計算
    const maxPos = await prisma.task.aggregate({
      where: { projectId, sectionId: sectionId ?? undefined },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? 0) + 1;

    const created = [];
    for (const t of toImport) {
      const task = await prisma.task.create({
        data: {
          title: t.title,
          description: t.description ?? null,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          projectId,
          sectionId: sectionId ?? null,
          createdById: user.id,
          position: position++,
          googleTaskId: t.googleTaskId,
          googleTaskListId: t.googleTaskListId,
          googleTaskSyncedAt: new Date(),
          importedFromGoogle: true,
          assignees: { create: [{ userId: user.id }] },
        },
      });
      created.push(task);
    }

    return successResponse({ imported: created.length, skipped }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
