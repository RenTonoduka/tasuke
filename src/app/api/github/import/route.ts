import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const importSchema = z.object({
  issues: z
    .array(
      z.object({
        githubIssueId: z.number(),
        githubIssueNodeId: z.string().min(1),
        githubRepoFullName: z.string().min(1),
        title: z.string().min(1).max(200),
        body: z.string().max(50000).optional().nullable(),
        checklistItems: z
          .array(z.object({ text: z.string(), checked: z.boolean() }))
          .optional()
          .default([]),
      })
    )
    .min(1)
    .max(50),
  projectId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  importSubtasks: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const { issues, projectId, sectionId, importSubtasks } = importSchema.parse(body);

    // プロジェクトアクセス + VIEWER権限チェック
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { isPrivate: true, workspaceId: true },
    });
    if (!project) return errorResponse('プロジェクトが見つかりません', 404);

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: user.id },
    });
    if (!membership) return errorResponse('ワークスペースへのアクセス権がありません', 403);
    if (membership.role === 'VIEWER') return errorResponse('閲覧者はタスクを取り込めません', 403);

    if (project.isPrivate && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      const pm = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: user.id } },
      });
      if (!pm) return errorResponse('プロジェクトへのアクセス権がありません', 403);
    }

    // sectionId未指定時は最初のセクションに自動割り当て
    let resolvedSectionId = sectionId ?? null;
    if (!resolvedSectionId) {
      const firstSection = await prisma.section.findFirst({
        where: { projectId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      resolvedSectionId = firstSection?.id ?? null;
    }

    // 重複チェック
    const nodeIds = issues.map((i) => i.githubIssueNodeId);
    const existing = await prisma.task.findMany({
      where: { githubIssueNodeId: { in: nodeIds } },
      select: { githubIssueNodeId: true },
    });
    const existingSet = new Set(existing.map((t) => t.githubIssueNodeId));
    const toImport = issues.filter((i) => !existingSet.has(i.githubIssueNodeId));
    const skipped = issues.length - toImport.length;

    if (toImport.length === 0) {
      return successResponse({ imported: 0, skipped }, 200);
    }

    // position計算
    const maxPos = await prisma.task.aggregate({
      where: { projectId, sectionId: resolvedSectionId ?? undefined },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? 0) + 1;

    // バッチ作成
    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const issue of toImport) {
        const task = await tx.task.create({
          data: {
            title: issue.title,
            description: issue.body ?? null,
            projectId,
            sectionId: resolvedSectionId,
            createdById: user.id,
            position: position++,
            githubIssueId: issue.githubIssueId,
            githubIssueNodeId: issue.githubIssueNodeId,
            githubRepoFullName: issue.githubRepoFullName,
            githubIssueSyncedAt: new Date(),
            importedFromGitHub: true,
            githubSyncSource: 'github',
            assignees: { create: [{ userId: user.id }] },
          },
        });

        // チェックリストをサブタスクとして作成
        if (importSubtasks && issue.checklistItems && issue.checklistItems.length > 0) {
          let subPos = 1;
          for (const item of issue.checklistItems) {
            if (!item.text.trim()) continue;
            await tx.task.create({
              data: {
                title: item.text.trim(),
                parentId: task.id,
                projectId,
                sectionId: resolvedSectionId,
                createdById: user.id,
                position: subPos++,
                status: item.checked ? 'DONE' : 'TODO',
                completedAt: item.checked ? new Date() : null,
              },
            });
          }
        }

        created.push(task);
      }
      return created;
    });

    return successResponse({ imported: result.length, skipped }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
