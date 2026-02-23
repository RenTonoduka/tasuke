import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const importSchema = z.object({
  tasks: z
    .array(
      z.object({
        googleTaskId: z.string().min(1),
        googleTaskListId: z.string().min(1),
        title: z.string().max(200),
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

    // プロジェクトアクセス + VIEWER権限チェック
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { isPrivate: true, workspaceId: true },
    });
    if (!project) {
      return errorResponse('プロジェクトが見つかりません', 404);
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: user.id },
    });
    if (!membership) {
      return errorResponse('ワークスペースへのアクセス権がありません', 403);
    }
    if (membership.role === 'VIEWER') {
      return errorResponse('閲覧者はタスクを取り込めません', 403);
    }

    if (project.isPrivate && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      const pm = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: user.id } },
      });
      if (!pm) {
        return errorResponse('プロジェクトへのアクセス権がありません', 403);
      }
    }

    // 空タイトルをフィルタ（Google Tasksはタイトルなしのタスクがある）
    const validTasks = tasks.filter((t) => t.title && t.title.trim().length > 0);
    if (validTasks.length === 0) {
      return errorResponse('取り込み可能なタスクがありません（タイトルが空）', 400);
    }

    // 重複チェック
    const googleTaskIds = validTasks.map((t) => t.googleTaskId);
    const existing = await prisma.task.findMany({
      where: { googleTaskId: { in: googleTaskIds } },
      select: { googleTaskId: true },
    });
    const existingSet = new Set(existing.map((t) => t.googleTaskId));
    const toImport = validTasks.filter((t) => !existingSet.has(t.googleTaskId));
    const skipped = tasks.length - toImport.length;

    if (toImport.length === 0) {
      return successResponse({ imported: 0, skipped }, 200);
    }

    // position計算
    const maxPos = await prisma.task.aggregate({
      where: { projectId, sectionId: sectionId ?? undefined },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? 0) + 1;

    // バッチ作成（トランザクション）
    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const t of toImport) {
        const task = await tx.task.create({
          data: {
            title: t.title.trim(),
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
      return created;
    });

    return successResponse({ imported: result.length, skipped }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
