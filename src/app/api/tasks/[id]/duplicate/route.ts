import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { canAccessProject } from '@/lib/project-access';
import { logActivity } from '@/lib/activity';

/**
 * POST /api/tasks/[id]/duplicate
 *
 * 指定タスクを複製する。タイトルは「(コピー)」サフィックス付き、
 * 同じセクション末尾に配置。assignees / labels もコピー。
 * subtasks / comments / attachments / activity / GitHub linkage 等はコピーしない。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const source = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        assignees: { select: { userId: true } },
        labels: { select: { labelId: true } },
      },
    });
    if (!source) return errorResponse('タスクが見つかりません', 404);

    if (!(await canAccessProject(user.id, source.projectId))) {
      return errorResponse('プロジェクトへのアクセス権がありません', 403);
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        workspace: { projects: { some: { id: source.projectId } } },
      },
      select: { role: true },
    });
    if (membership?.role === 'VIEWER') {
      return errorResponse('閲覧者はタスクを作成できません', 403);
    }

    // position: 同セクション末尾に配置
    const maxPos = await prisma.task.aggregate({
      where: { projectId: source.projectId, sectionId: source.sectionId },
      _max: { position: true },
    });

    const created = await prisma.task.create({
      data: {
        title: `${source.title} (コピー)`,
        description: source.description,
        priority: source.priority,
        status: source.status,
        startDate: source.startDate,
        dueDate: source.dueDate,
        scheduledStart: source.scheduledStart,
        scheduledEnd: source.scheduledEnd,
        estimatedHours: source.estimatedHours,
        projectId: source.projectId,
        sectionId: source.sectionId,
        createdById: user.id,
        position: (maxPos._max.position ?? 0) + 1,
        // リレーションコピー
        assignees: source.assignees.length
          ? { create: source.assignees.map((a) => ({ userId: a.userId })) }
          : undefined,
        labels: source.labels.length
          ? { create: source.labels.map((l) => ({ labelId: l.labelId })) }
          : undefined,
      },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        labels: { include: { label: true } },
        _count: { select: { subtasks: true } },
      },
    });

    await logActivity({ type: 'TASK_CREATED', userId: user.id, taskId: created.id });

    return successResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
