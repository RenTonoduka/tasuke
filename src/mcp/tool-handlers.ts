import prisma from '@/lib/prisma';
import { TaskStatus } from '@prisma/client';
import { getAccessibleProjectIds } from '@/lib/project-access';

// 既知のセクション名に対するデフォルトプリセット（色 + statusMapping）
const DEFAULT_SECTION_PRESET: Record<string, { color: string; statusMapping: TaskStatus }> = {
  'Todo': { color: '#9AA0A6', statusMapping: 'TODO' },
  'todo': { color: '#9AA0A6', statusMapping: 'TODO' },
  'TODO': { color: '#9AA0A6', statusMapping: 'TODO' },
  'やること': { color: '#9AA0A6', statusMapping: 'TODO' },
  '未着手': { color: '#9AA0A6', statusMapping: 'TODO' },
  '進行中': { color: '#4285F4', statusMapping: 'IN_PROGRESS' },
  'In Progress': { color: '#4285F4', statusMapping: 'IN_PROGRESS' },
  '対応中': { color: '#4285F4', statusMapping: 'IN_PROGRESS' },
  '完了': { color: '#34A853', statusMapping: 'DONE' },
  'Done': { color: '#34A853', statusMapping: 'DONE' },
  'done': { color: '#34A853', statusMapping: 'DONE' },
};
import { getGoogleClient, getCalendarClient, getTasksClient } from '@/lib/google';
import { findFreeSlots, generateScheduleSuggestions } from '@/lib/schedule';
import type { CalendarEvent, SchedulableTask } from '@/lib/schedule';
import { getGitHubToken, githubApi } from '@/lib/github';
import { parseChecklistItems } from '@/lib/github-checklist';
import { generateApiToken, hashToken } from '@/lib/api-token';

export interface ToolContext {
  userId: string;
  workspaceId: string;
}

export interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function err(message: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

// ==================== Task Tools ====================

export async function handleTaskList(
  params: {
    projectId?: string;
    sectionId?: string;
    status?: string;
    priority?: string;
    dueBefore?: string;
    dueAfter?: string;
    limit?: number;
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (params.projectId && !accessibleIds.includes(params.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const dueDate: Record<string, Date> = {};
    if (params.dueBefore) dueDate.lt = new Date(params.dueBefore);
    if (params.dueAfter) dueDate.gte = new Date(params.dueAfter);

    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        projectId: params.projectId ? params.projectId : { in: accessibleIds },
        ...(params.sectionId && { sectionId: params.sectionId }),
        ...(params.status && { status: params.status as 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED' }),
        ...(params.priority && { priority: params.priority as 'P0' | 'P1' | 'P2' | 'P3' }),
        ...(Object.keys(dueDate).length > 0 && { dueDate }),
      },
      include: {
        section: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
        labels: { include: { label: true } },
        _count: { select: { subtasks: true } },
      },
      orderBy: [{ priority: 'asc' }, { position: 'asc' }],
      take: params.limit ?? 50,
    });
    return ok(tasks);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleTaskCreate(
  params: {
    title: string;
    projectId: string;
    sectionId?: string;
    priority?: string;
    status?: string;
    dueDate?: string;
    description?: string;
    estimatedHours?: number;
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(params.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    let sectionId = params.sectionId ?? null;
    if (!sectionId) {
      const firstSection = await prisma.section.findFirst({
        where: { projectId: params.projectId },
        orderBy: { position: 'asc' },
      });
      sectionId = firstSection?.id ?? null;
    }

    const maxPos = await prisma.task.aggregate({
      where: { projectId: params.projectId, sectionId },
      _max: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        title: params.title,
        projectId: params.projectId,
        sectionId,
        priority: (params.priority ?? 'P3') as 'P0' | 'P1' | 'P2' | 'P3',
        status: (params.status ?? 'TODO') as 'TODO' | 'IN_PROGRESS' | 'DONE',
        dueDate: params.dueDate ? new Date(params.dueDate) : null,
        description: params.description ?? null,
        estimatedHours: params.estimatedHours ?? null,
        position: (maxPos._max.position ?? 0) + 1,
        createdById: ctx.userId,
      },
      include: {
        section: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
    return ok(task);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleTaskUpdate(
  params: {
    taskId: string;
    title?: string;
    status?: string;
    priority?: string;
    startDate?: string | null;
    dueDate?: string | null;
    estimatedHours?: number | null;
    description?: string | null;
    sectionId?: string | null;
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { projectId: true },
    });
    if (!task) return err('タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const { taskId, ...data } = params;
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'DONE') updateData.completedAt = new Date();
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sectionId !== undefined) updateData.sectionId = data.sectionId;

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        section: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
    return ok(updated);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleTaskDelete(
  params: { taskId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { projectId: true },
    });
    if (!task) return err('タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    await prisma.task.delete({ where: { id: params.taskId } });
    return ok({ success: true, deletedId: params.taskId });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleTaskMove(
  params: { taskId: string; sectionId: string | null; projectId?: string; position?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { projectId: true },
    });
    if (!task) return err('タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const updateData: Record<string, unknown> = {};

    // プロジェクト間移動
    if (params.projectId && params.projectId !== task.projectId) {
      if (!accessibleIds.includes(params.projectId)) {
        return err('移動先プロジェクトへのアクセス権がありません');
      }
      updateData.projectId = params.projectId;
      // sectionIdが指定されていなければ移動先の最初のセクションに割り当て
      if (params.sectionId === undefined || params.sectionId === null) {
        const firstSection = await prisma.section.findFirst({
          where: { projectId: params.projectId },
          orderBy: { position: 'asc' },
        });
        updateData.sectionId = firstSection?.id ?? null;
      } else {
        updateData.sectionId = params.sectionId;
      }
    } else {
      updateData.sectionId = params.sectionId;
    }

    let position = params.position;
    if (position === undefined) {
      const targetSectionId = (updateData.sectionId as string | null) ?? params.sectionId;
      const maxPos = await prisma.task.aggregate({
        where: { sectionId: targetSectionId },
        _max: { position: true },
      });
      position = (maxPos._max.position ?? 0) + 1;
    }
    updateData.position = position;

    const updated = await prisma.task.update({
      where: { id: params.taskId },
      data: updateData,
      include: {
        section: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
    return ok(updated);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleTaskSearch(
  params: { query: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);

    const tasks = await prisma.task.findMany({
      where: {
        projectId: { in: accessibleIds },
        OR: [
          { title: { contains: params.query, mode: 'insensitive' } },
          { description: { contains: params.query, mode: 'insensitive' } },
        ],
      },
      include: {
        section: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: params.limit ?? 20,
    });
    return ok(tasks);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Project Tools ====================

export async function handleProjectList(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);

    const projects = await prisma.project.findMany({
      where: { id: { in: accessibleIds } },
      include: {
        sections: { orderBy: { position: 'asc' }, select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { position: 'asc' },
    });
    return ok(projects);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleProjectCreate(
  params: { name: string; color?: string; description?: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const maxPos = await prisma.project.aggregate({
      where: { workspaceId: ctx.workspaceId },
      _max: { position: true },
    });

    const project = await prisma.project.create({
      data: {
        name: params.name,
        color: params.color ?? '#4285F4',
        description: params.description ?? null,
        workspaceId: ctx.workspaceId,
        position: (maxPos._max.position ?? 0) + 1,
        sections: {
          create: [
            { name: 'Todo', position: 0, color: '#9AA0A6', statusMapping: 'TODO' },
            { name: '進行中', position: 1, color: '#4285F4', statusMapping: 'IN_PROGRESS' },
            { name: '完了', position: 2, color: '#34A853', statusMapping: 'DONE' },
          ],
        },
      },
      include: { sections: { orderBy: { position: 'asc' } } },
    });
    return ok(project);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleProjectUpdate(
  params: { projectId: string; name?: string; color?: string; description?: string | null },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(params.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const { projectId, ...data } = params;
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.description !== undefined) updateData.description = data.description;

    const project = await prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });
    return ok(project);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleProjectDelete(
  params: { projectId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(params.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    await prisma.project.delete({ where: { id: params.projectId } });
    return ok({ success: true, deletedId: params.projectId });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Section Tools ====================

export async function handleSectionList(
  params: { projectId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(params.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const sections = await prisma.section.findMany({
      where: { projectId: params.projectId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { position: 'asc' },
    });
    return ok(sections);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleSectionCreate(
  params: { projectId: string; name: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(params.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const maxPos = await prisma.section.aggregate({
      where: { projectId: params.projectId },
      _max: { position: true },
    });

    const section = await prisma.section.create({
      data: {
        name: params.name,
        projectId: params.projectId,
        position: (maxPos._max.position ?? 0) + 1,
      },
    });
    return ok(section);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleSectionUpdate(
  params: { sectionId: string; name: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const section = await prisma.section.findUnique({
      where: { id: params.sectionId },
      select: { projectId: true },
    });
    if (!section) return err('セクションが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(section.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const updated = await prisma.section.update({
      where: { id: params.sectionId },
      data: { name: params.name },
    });
    return ok(updated);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Subtask Tools ====================

export async function handleSubtaskList(
  params: { taskId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { projectId: true },
    });
    if (!task) return err('タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const subtasks = await prisma.task.findMany({
      where: { parentId: params.taskId },
      select: { id: true, title: true, status: true, priority: true, dueDate: true, position: true },
      orderBy: { position: 'asc' },
    });
    return ok(subtasks);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleSubtaskCreate(
  params: { parentId: string; title: string; priority?: string; dueDate?: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const parent = await prisma.task.findUnique({
      where: { id: params.parentId },
      select: { projectId: true, sectionId: true },
    });
    if (!parent) return err('親タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(parent.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const maxPos = await prisma.task.aggregate({
      where: { parentId: params.parentId },
      _max: { position: true },
    });

    const subtask = await prisma.task.create({
      data: {
        title: params.title,
        projectId: parent.projectId,
        sectionId: parent.sectionId,
        parentId: params.parentId,
        priority: (params.priority ?? 'P3') as 'P0' | 'P1' | 'P2' | 'P3',
        dueDate: params.dueDate ? new Date(params.dueDate) : null,
        position: (maxPos._max.position ?? 0) + 1,
        createdById: ctx.userId,
      },
    });
    return ok(subtask);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleSubtaskToggle(
  params: { subtaskId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.subtaskId },
      select: { status: true, projectId: true },
    });
    if (!task) return err('サブタスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    const updated = await prisma.task.update({
      where: { id: params.subtaskId },
      data: { status: newStatus, completedAt: newStatus === 'DONE' ? new Date() : null },
    });
    return ok(updated);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Label Tools ====================

export async function handleLabelList(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const labels = await prisma.label.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
    });
    return ok(labels);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleLabelCreate(
  params: { name: string; color?: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const label = await prisma.label.create({
      data: {
        name: params.name,
        color: params.color ?? '#4285F4',
        workspaceId: ctx.workspaceId,
      },
    });
    return ok(label);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleTaskLabelSet(
  params: { taskId: string; labelIds: string[] },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      include: { labels: true },
    });
    if (!task) return err('タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const currentIds = task.labels.map((l) => l.labelId);
    const toAdd = params.labelIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !params.labelIds.includes(id));

    await prisma.$transaction([
      ...toRemove.map((labelId) =>
        prisma.taskLabel.deleteMany({ where: { taskId: params.taskId, labelId } }),
      ),
      ...toAdd.map((labelId) =>
        prisma.taskLabel.create({ data: { taskId: params.taskId, labelId } }),
      ),
    ]);

    const updated = await prisma.task.findUnique({
      where: { id: params.taskId },
      include: { labels: { include: { label: true } } },
    });
    return ok(updated?.labels ?? []);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Comment Tools ====================

export async function handleCommentList(
  params: { taskId: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { projectId: true },
    });
    if (!task) return err('タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const comments = await prisma.comment.findMany({
      where: { taskId: params.taskId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 20,
    });
    return ok(comments);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleCommentAdd(
  params: { taskId: string; content: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { projectId: true },
    });
    if (!task) return err('タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const comment = await prisma.comment.create({
      data: { taskId: params.taskId, content: params.content, userId: ctx.userId },
      include: { user: { select: { id: true, name: true } } },
    });
    return ok(comment);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Task Bulk Tools ====================

export async function handleTaskBulkUpdate(
  params: {
    taskIds: string[];
    action: 'status' | 'priority' | 'delete';
    value?: string;
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);

    const tasks = await prisma.task.findMany({
      where: { id: { in: params.taskIds }, projectId: { in: accessibleIds } },
      select: { id: true },
    });
    if (tasks.length === 0) return err('対象タスクが見つかりません');
    const validIds = tasks.map((t) => t.id);

    switch (params.action) {
      case 'status': {
        if (!params.value) return err('ステータスを指定してください');
        const updateData: Record<string, unknown> = { status: params.value };
        if (params.value === 'DONE') updateData.completedAt = new Date();
        else updateData.completedAt = null;
        await prisma.task.updateMany({ where: { id: { in: validIds } }, data: updateData });
        return ok({ updated: validIds.length, action: 'status', value: params.value });
      }
      case 'priority': {
        if (!params.value) return err('優先度を指定してください');
        await prisma.task.updateMany({ where: { id: { in: validIds } }, data: { priority: params.value as 'P0' | 'P1' | 'P2' | 'P3' } });
        return ok({ updated: validIds.length, action: 'priority', value: params.value });
      }
      case 'delete': {
        await prisma.task.deleteMany({ where: { id: { in: validIds } } });
        return ok({ deleted: validIds.length });
      }
      default:
        return err('不明なアクションです');
    }
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Assignee Tools ====================

export async function handleTaskAssigneeSet(
  params: { taskId: string; userIds: string[] },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      include: { assignees: true },
    });
    if (!task) return err('タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    if (params.userIds.length > 0) {
      const validMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: ctx.workspaceId, userId: { in: params.userIds } },
        select: { userId: true },
      });
      const validSet = new Set(validMembers.map((m) => m.userId));
      const invalid = params.userIds.filter((id) => !validSet.has(id));
      if (invalid.length > 0) return err('ワークスペースに所属していないユーザーが含まれています');
    }

    const currentIds = task.assignees.map((a) => a.userId);
    const toAdd = params.userIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !params.userIds.includes(id));

    await prisma.$transaction([
      ...toRemove.map((userId) =>
        prisma.taskAssignment.deleteMany({ where: { taskId: params.taskId, userId } }),
      ),
      ...toAdd.map((userId) =>
        prisma.taskAssignment.create({ data: { taskId: params.taskId, userId } }),
      ),
    ]);

    const updated = await prisma.task.findUnique({
      where: { id: params.taskId },
      include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
    });
    return ok(updated?.assignees ?? []);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Activity Tools ====================

export async function handleActivityList(
  params: { taskId: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { projectId: true },
    });
    if (!task) return err('タスクが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const activities = await prisma.activity.findMany({
      where: { taskId: params.taskId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 30,
    });
    return ok(activities);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Notification Tools ====================

export async function handleNotificationList(
  params: { unreadOnly?: boolean; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: ctx.userId,
        ...(params.unreadOnly && { read: false }),
      },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: params.limit ?? 50,
    });
    return ok(notifications);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleNotificationRead(
  params: { notificationId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: params.notificationId },
    });
    if (!notification) return err('通知が見つかりません');
    if (notification.userId !== ctx.userId) return err('権限がありません');

    const updated = await prisma.notification.update({
      where: { id: params.notificationId },
      data: { read: true },
    });
    return ok(updated);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleNotificationReadAll(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: ctx.userId, read: false },
      data: { read: true },
    });
    return ok({ success: true, updated: result.count });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Comment Update/Delete ====================

export async function handleCommentUpdate(
  params: { commentId: string; content: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
      include: { task: { select: { projectId: true } } },
    });
    if (!comment) return err('コメントが見つかりません');
    if (comment.userId !== ctx.userId) return err('自分のコメントのみ編集できます');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(comment.task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    const trimmed = params.content.trim();
    if (!trimmed) return err('コメント内容が必要です');

    const updated = await prisma.comment.update({
      where: { id: params.commentId },
      data: { content: trimmed },
      include: { user: { select: { id: true, name: true } } },
    });
    return ok(updated);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleCommentDelete(
  params: { commentId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
      include: { task: { select: { projectId: true } } },
    });
    if (!comment) return err('コメントが見つかりません');
    if (comment.userId !== ctx.userId) return err('自分のコメントのみ削除できます');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(comment.task.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    await prisma.comment.delete({ where: { id: params.commentId } });
    return ok({ success: true, deletedId: params.commentId });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Section Delete ====================

export async function handleSectionDelete(
  params: { sectionId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const section = await prisma.section.findUnique({
      where: { id: params.sectionId },
      select: { projectId: true },
    });
    if (!section) return err('セクションが見つかりません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(section.projectId)) {
      return err('プロジェクトへのアクセス権がありません');
    }

    await prisma.section.delete({ where: { id: params.sectionId } });
    return ok({ success: true, deletedId: params.sectionId });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Dashboard Tools ====================

export async function handleDashboard(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const baseWhere = {
      projectId: { in: accessibleIds },
      parentId: null,
      status: { notIn: ['DONE' as const, 'ARCHIVED' as const] },
    };

    const include = {
      project: { select: { id: true, name: true, color: true } },
      section: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
    };

    const [overdue, dueToday, dueThisWeek, inProgress] = await Promise.all([
      prisma.task.findMany({
        where: { ...baseWhere, dueDate: { lt: todayStart } },
        include,
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      prisma.task.findMany({
        where: { ...baseWhere, dueDate: { gte: todayStart, lt: todayEnd } },
        include,
        orderBy: { priority: 'asc' },
        take: 20,
      }),
      prisma.task.findMany({
        where: { ...baseWhere, dueDate: { gte: todayEnd, lt: weekEnd } },
        include,
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      prisma.task.findMany({
        where: { ...baseWhere, status: 'IN_PROGRESS' },
        include,
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ]);

    return ok({
      overdue: { count: overdue.length, tasks: overdue },
      dueToday: { count: dueToday.length, tasks: dueToday },
      dueThisWeek: { count: dueThisWeek.length, tasks: dueThisWeek },
      inProgress: { count: inProgress.length, tasks: inProgress },
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleMyTasks(
  params: { status?: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);

    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        projectId: { in: accessibleIds },
        assignees: { some: { userId: ctx.userId } },
        ...(params.status && { status: params.status as 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED' }),
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        section: { select: { id: true, name: true } },
        labels: { include: { label: true } },
        _count: { select: { subtasks: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
      take: params.limit ?? 30,
    });
    return ok(tasks);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Calendar Tools ====================

const PRIORITY_COLOR_MAP: Record<string, number> = { P0: 11, P1: 5, P2: 9, P3: 8 };

export async function handleCalendarEventList(
  params: { timeMin: string; timeMax: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const auth = await getGoogleClient(ctx.userId);
    const calendar = getCalendarClient(auth);
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      timeZone: 'Asia/Tokyo',
      fields: 'items(id,summary,start,end,status,colorId)',
    });
    const events = (response.data.items ?? [])
      .filter((e) => e.status !== 'cancelled')
      .map((e) => ({
        id: e.id,
        summary: e.summary ?? '(タイトルなし)',
        start: e.start?.dateTime ?? e.start?.date ?? '',
        end: e.end?.dateTime ?? e.end?.date ?? '',
        allDay: !!e.start?.date,
        colorId: e.colorId ?? null,
      }));
    return ok(events);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleCalendarEventCreate(
  params: { summary?: string; start: string; end: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const auth = await getGoogleClient(ctx.userId);
    const calendar = getCalendarClient(auth);
    const inserted = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: params.summary || '新しい予定',
        start: { dateTime: params.start, timeZone: 'Asia/Tokyo' },
        end: { dateTime: params.end, timeZone: 'Asia/Tokyo' },
      },
    });
    return ok({
      id: inserted.data.id,
      summary: inserted.data.summary ?? '(タイトルなし)',
      start: inserted.data.start?.dateTime ?? '',
      end: inserted.data.end?.dateTime ?? '',
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleCalendarEventUpdate(
  params: { eventId: string; start: string; end: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const auth = await getGoogleClient(ctx.userId);
    const calendar = getCalendarClient(auth);
    const updated = await calendar.events.patch({
      calendarId: 'primary',
      eventId: params.eventId,
      requestBody: {
        start: { dateTime: params.start, timeZone: 'Asia/Tokyo' },
        end: { dateTime: params.end, timeZone: 'Asia/Tokyo' },
      },
    });
    return ok({
      id: updated.data.id,
      summary: updated.data.summary ?? '(タイトルなし)',
      start: updated.data.start?.dateTime ?? '',
      end: updated.data.end?.dateTime ?? '',
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleCalendarEventDelete(
  params: { eventId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const auth = await getGoogleClient(ctx.userId);
    const calendar = getCalendarClient(auth);
    try {
      await calendar.events.delete({ calendarId: 'primary', eventId: params.eventId });
    } catch (delErr: unknown) {
      const status = (delErr as { response?: { status?: number } })?.response?.status;
      if (status !== 404 && status !== 410) throw delErr;
    }
    return ok({ success: true });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleScheduleBlockList(
  params: { taskIds: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const ids = params.taskIds.split(',').filter(Boolean);
    if (ids.length === 0) return ok([]);
    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        taskId: { in: ids },
        task: { project: { workspace: { members: { some: { userId: ctx.userId } } } } },
      },
    });
    return ok(blocks);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleScheduleBlockCreate(
  params: { taskId: string; date: string; start: string; end: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: params.taskId,
        project: { workspace: { members: { some: { userId: ctx.userId, role: { not: 'VIEWER' } } } } },
      },
      select: { id: true, title: true, description: true, priority: true },
    });
    if (!task) return err('タスクが見つかりません');

    const existing = await prisma.scheduleBlock.findUnique({
      where: { taskId_date_startTime: { taskId: params.taskId, date: params.date, startTime: params.start } },
    });
    if (existing) return ok(existing);

    const auth = await getGoogleClient(ctx.userId);
    const calendar = getCalendarClient(auth);
    const colorId = String(PRIORITY_COLOR_MAP[task.priority] ?? 8);
    const inserted = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `[tasuke] ${task.title}`,
        description: task.description ?? undefined,
        start: { dateTime: `${params.date}T${params.start}:00`, timeZone: 'Asia/Tokyo' },
        end: { dateTime: `${params.date}T${params.end}:00`, timeZone: 'Asia/Tokyo' },
        colorId,
      },
    });
    const googleEventId = inserted.data.id;
    if (!googleEventId) return err('イベントIDの取得に失敗');

    const block = await prisma.scheduleBlock.create({
      data: { taskId: params.taskId, googleCalendarEventId: googleEventId, date: params.date, startTime: params.start, endTime: params.end },
    });
    return ok(block);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleScheduleBlockDelete(
  params: { scheduleBlockId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const block = await prisma.scheduleBlock.findFirst({
      where: {
        id: params.scheduleBlockId,
        task: { project: { workspace: { members: { some: { userId: ctx.userId, role: { not: 'VIEWER' } } } } } },
      },
    });
    if (!block) return err('ブロックが見つかりません');

    const auth = await getGoogleClient(ctx.userId);
    const calendar = getCalendarClient(auth);
    try {
      await calendar.events.delete({ calendarId: 'primary', eventId: block.googleCalendarEventId });
    } catch (delErr: unknown) {
      const status = (delErr as { response?: { status?: number } })?.response?.status;
      if (status !== 404 && status !== 410) throw delErr;
    }
    await prisma.scheduleBlock.delete({ where: { id: params.scheduleBlockId } });
    return ok({ success: true });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleScheduleSuggest(
  params: { projectId?: string; myTasksOnly?: boolean; workStart?: number; workEnd?: number; skipWeekends?: boolean },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const workStart = params.workStart ?? 9;
    const workEnd = params.workEnd ?? 18;
    const skipWeekends = params.skipWeekends ?? true;

    const whereClause: Record<string, unknown> = {
      status: { in: ['TODO', 'IN_PROGRESS'] },
      dueDate: { not: null },
      estimatedHours: { not: null },
      project: { workspace: { members: { some: { userId: ctx.userId } } } },
    };
    if (params.projectId) whereClause.projectId = params.projectId;
    if (params.myTasksOnly) whereClause.assignees = { some: { userId: ctx.userId } };

    const tasks = await prisma.task.findMany({
      where: whereClause,
      select: { id: true, title: true, dueDate: true, estimatedHours: true, priority: true },
      orderBy: { dueDate: 'asc' },
    });

    const incompleteWhere: Record<string, unknown> = {
      status: { in: ['TODO', 'IN_PROGRESS'] },
      OR: [{ dueDate: null }, { estimatedHours: null }],
      project: { workspace: { members: { some: { userId: ctx.userId } } } },
    };
    if (params.projectId) incompleteWhere.projectId = params.projectId;
    if (params.myTasksOnly) incompleteWhere.assignees = { some: { userId: ctx.userId } };

    const incompleteTasks = await prisma.task.findMany({
      where: incompleteWhere,
      select: { id: true, title: true, priority: true, dueDate: true, estimatedHours: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unestimatedTasks = incompleteTasks.map((t) => ({
      id: t.id, title: t.title, priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? '',
      missingDueDate: !t.dueDate, missingEstimate: !t.estimatedHours,
    }));

    if (tasks.length === 0) {
      return ok({ suggestions: [], unschedulable: [], totalFreeHours: 0, unestimatedCount: unestimatedTasks.length, unestimatedTasks });
    }

    const now = new Date();
    const maxDueDate = tasks.reduce((max, t) => (t.dueDate && t.dueDate > max ? t.dueDate : max), now);
    const timeMax = new Date(maxDueDate);
    timeMax.setDate(timeMax.getDate() + 1);

    let calendarEvents: CalendarEvent[] = [];
    let calendarUnavailable = false;
    try {
      const auth = await getGoogleClient(ctx.userId);
      const calendar = getCalendarClient(auth);
      const response = await calendar.events.list({
        calendarId: 'primary', timeMin: now.toISOString(), timeMax: timeMax.toISOString(),
        singleEvents: true, orderBy: 'startTime', maxResults: 250, timeZone: 'Asia/Tokyo',
        fields: 'items(id,summary,start,end,status)',
      });
      calendarEvents = (response.data.items ?? [])
        .filter((e) => e.status !== 'cancelled')
        .map((e) => ({ start: e.start?.dateTime ?? e.start?.date ?? '', end: e.end?.dateTime ?? e.end?.date ?? '', allDay: !!e.start?.date }));
    } catch {
      calendarUnavailable = true;
    }

    const freeSlots = findFreeSlots(calendarEvents, now, timeMax, workStart, workEnd, skipWeekends);
    const schedulableTasks: SchedulableTask[] = tasks
      .filter((t): t is typeof t & { dueDate: Date; estimatedHours: number } => t.dueDate !== null && t.estimatedHours !== null)
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate.toISOString(), estimatedHours: t.estimatedHours, priority: t.priority as SchedulableTask['priority'] }));
    const result = generateScheduleSuggestions(schedulableTasks, freeSlots);

    return ok({ ...result, unestimatedCount: unestimatedTasks.length, unestimatedTasks, calendarUnavailable });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Workspace Tools ====================

export async function handleWorkspaceList(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: { members: { some: { userId: ctx.userId } } },
      include: {
        members: { select: { id: true, role: true, userId: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return ok(workspaces);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleWorkspaceCreate(
  params: { name: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const slug = params.name.toLowerCase()
      .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '-')
      .replace(/-+/g, '-').slice(0, 30) + '-' + Date.now().toString(36);
    const workspace = await prisma.workspace.create({
      data: { name: params.name, slug, members: { create: { userId: ctx.userId, role: 'OWNER' } } },
      include: { members: true },
    });
    return ok(workspace);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleWorkspaceUpdate(
  params: { workspaceId: string; name: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.workspaceId, userId: ctx.userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!member) return err('権限がありません');
    const workspace = await prisma.workspace.update({
      where: { id: params.workspaceId },
      data: { name: params.name },
    });
    return ok(workspace);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleWorkspaceDelete(
  params: { workspaceId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: params.workspaceId, userId: ctx.userId, role: 'OWNER' },
    });
    if (!member) return err('オーナーのみ削除できます');
    await prisma.workspace.delete({ where: { id: params.workspaceId } });
    return ok({ success: true, deletedId: params.workspaceId });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleWorkspaceStats(
  params: { workspaceId?: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const wsId = params.workspaceId ?? ctx.workspaceId;
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: wsId, userId: ctx.userId },
    });
    if (!member) return err('アクセス権がありません');

    const accessibleIds = await getAccessibleProjectIds(ctx.userId, wsId);
    const baseWhere = { projectId: { in: accessibleIds }, parentId: null as string | null };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, completed, overdue, inProgress, byStatus, byPriority] = await Promise.all([
      prisma.task.count({ where: baseWhere }),
      prisma.task.count({ where: { ...baseWhere, status: 'DONE' } }),
      prisma.task.count({ where: { ...baseWhere, status: { notIn: ['DONE', 'ARCHIVED'] }, dueDate: { lt: todayStart } } }),
      prisma.task.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
      prisma.task.groupBy({ by: ['status'], where: baseWhere, _count: true }),
      prisma.task.groupBy({ by: ['priority'], where: baseWhere, _count: true }),
    ]);

    return ok({ overview: { total, completed, overdue, inProgress }, byStatus, byPriority });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Member Tools ====================

export async function handleMemberList(
  params: { workspaceId?: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const wsId = params.workspaceId ?? ctx.workspaceId;
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: wsId, userId: ctx.userId },
    });
    if (!membership) return err('アクセス権がありません');

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: wsId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return ok(members);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleMemberInvite(
  params: { email: string; role?: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: ctx.workspaceId, userId: ctx.userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) return err('OWNER/ADMINのみメンバーを追加できます');

    let targetUser = await prisma.user.findUnique({ where: { email: params.email } });
    if (!targetUser) {
      targetUser = await prisma.user.create({ data: { email: params.email, name: params.email.split('@')[0] } });
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: { workspaceId: ctx.workspaceId, userId: targetUser.id },
    });
    if (existing) return err('すでにメンバーです');

    const role = (params.role ?? 'MEMBER') as 'ADMIN' | 'MEMBER' | 'VIEWER';
    const member = await prisma.workspaceMember.create({
      data: { workspaceId: ctx.workspaceId, userId: targetUser.id, role },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });
    return ok(member);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleMemberRemove(
  params: { memberId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: ctx.workspaceId, userId: ctx.userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) return err('OWNER/ADMINのみメンバーを削除できます');

    const target = await prisma.workspaceMember.findUnique({ where: { id: params.memberId } });
    if (!target || target.workspaceId !== ctx.workspaceId) return err('メンバーが見つかりません');

    await prisma.workspaceMember.delete({ where: { id: params.memberId } });
    return ok({ success: true, deletedId: params.memberId });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Attachment Tools ====================

export async function handleAttachmentList(
  params: { taskId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({ where: { id: params.taskId }, select: { projectId: true } });
    if (!task) return err('タスクが見つかりません');
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) return err('アクセス権がありません');

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: params.taskId },
      orderBy: { createdAt: 'desc' },
    });
    return ok(attachments);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleAttachmentAdd(
  params: { taskId: string; driveFileId: string; fileName?: string; mimeType?: string; url?: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const task = await prisma.task.findUnique({ where: { id: params.taskId }, select: { projectId: true } });
    if (!task) return err('タスクが見つかりません');
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(task.projectId)) return err('アクセス権がありません');

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: params.taskId,
        driveFileId: params.driveFileId,
        name: params.fileName ?? 'file',
        mimeType: params.mimeType ?? 'application/octet-stream',
        url: params.url ?? `https://drive.google.com/file/d/${params.driveFileId}/view`,
        userId: ctx.userId,
      },
    });
    return ok(attachment);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleAttachmentDelete(
  params: { attachmentId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: params.attachmentId },
      include: { task: { select: { projectId: true } } },
    });
    if (!attachment) return err('添付ファイルが見つかりません');
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(attachment.task.projectId)) return err('アクセス権がありません');

    await prisma.taskAttachment.delete({ where: { id: params.attachmentId } });
    return ok({ success: true, deletedId: params.attachmentId });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Automation Tools ====================

export async function handleAutomationList(
  params: { projectId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(params.projectId)) return err('アクセス権がありません');

    const rules = await prisma.automationRule.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: 'asc' },
    });
    return ok(rules);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleAutomationCreate(
  params: { projectId: string; name: string; trigger: unknown; action: unknown },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(params.projectId)) return err('アクセス権がありません');

    const rule = await prisma.automationRule.create({
      data: {
        name: params.name,
        trigger: JSON.parse(JSON.stringify(params.trigger)),
        action: JSON.parse(JSON.stringify(params.action)),
        projectId: params.projectId,
        createdById: ctx.userId,
      },
    });
    return ok(rule);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleAutomationUpdate(
  params: { ruleId: string; name?: string; enabled?: boolean; trigger?: unknown; action?: unknown },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const rule = await prisma.automationRule.findUnique({ where: { id: params.ruleId }, select: { projectId: true } });
    if (!rule) return err('ルールが見つかりません');
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(rule.projectId)) return err('アクセス権がありません');

    const updateData: Record<string, unknown> = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.enabled !== undefined) updateData.enabled = params.enabled;
    if (params.trigger !== undefined) updateData.trigger = params.trigger;
    if (params.action !== undefined) updateData.action = params.action;

    const updated = await prisma.automationRule.update({ where: { id: params.ruleId }, data: updateData });
    return ok(updated);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleAutomationDelete(
  params: { ruleId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const rule = await prisma.automationRule.findUnique({ where: { id: params.ruleId }, select: { projectId: true } });
    if (!rule) return err('ルールが見つかりません');
    const accessibleIds = await getAccessibleProjectIds(ctx.userId, ctx.workspaceId);
    if (!accessibleIds.includes(rule.projectId)) return err('アクセス権がありません');

    await prisma.automationRule.delete({ where: { id: params.ruleId } });
    return ok({ success: true, deletedId: params.ruleId });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Template Tools ====================

export async function handleTemplateList(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const templates = await prisma.projectTemplate.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { _count: { select: { taskTemplates: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(templates);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleTemplateCreate(
  params: {
    name: string;
    description?: string;
    color?: string;
    taskTemplates?: { title: string; description?: string; priority?: string; section?: string; position?: number }[];
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const template = await prisma.projectTemplate.create({
      data: {
        name: params.name,
        description: params.description,
        color: params.color ?? '#4285F4',
        workspaceId: ctx.workspaceId,
        taskTemplates: {
          create: (params.taskTemplates ?? []).map((t) => ({
            title: t.title,
            description: t.description,
            priority: (t.priority ?? 'P3') as 'P0' | 'P1' | 'P2' | 'P3',
            section: t.section ?? 'Todo',
            position: t.position ?? 0,
          })),
        },
      },
      include: { taskTemplates: { orderBy: { position: 'asc' } } },
    });
    return ok(template);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleTemplateDelete(
  params: { templateId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const template = await prisma.projectTemplate.findFirst({
      where: { id: params.templateId, workspaceId: ctx.workspaceId },
    });
    if (!template) return err('テンプレートが見つかりません');

    await prisma.projectTemplate.delete({ where: { id: params.templateId, workspaceId: ctx.workspaceId } });
    return ok({ success: true, deletedId: params.templateId });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleProjectFromTemplate(
  params: { templateId: string; name: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const template = await prisma.projectTemplate.findFirst({
      where: { id: params.templateId, workspaceId: ctx.workspaceId },
      include: { taskTemplates: { orderBy: { position: 'asc' } } },
    });
    if (!template) return err('テンプレートが見つかりません');

    const sectionNames: string[] = [];
    for (const tt of template.taskTemplates) {
      if (!sectionNames.includes(tt.section)) sectionNames.push(tt.section);
    }
    if (sectionNames.length === 0) sectionNames.push('Todo', '進行中', '完了');

    const maxPos = await prisma.project.aggregate({
      where: { workspaceId: ctx.workspaceId },
      _max: { position: true },
    });

    const project = await prisma.project.create({
      data: {
        name: params.name,
        color: template.color,
        workspaceId: ctx.workspaceId,
        position: (maxPos._max.position ?? 0) + 1,
        sections: {
          create: sectionNames.map((name, index) => {
            const preset = DEFAULT_SECTION_PRESET[name];
            return {
              name,
              position: index,
              color: preset?.color ?? null,
              statusMapping: preset?.statusMapping ?? null,
            };
          }),
        },
      },
      include: { sections: { orderBy: { position: 'asc' } } },
    });

    const sectionMap = new Map(project.sections.map((s) => [s.name, s.id]));
    const defaultSectionId = project.sections[0]?.id;

    if (template.taskTemplates.length > 0 && defaultSectionId) {
      await prisma.task.createMany({
        data: template.taskTemplates.map((tt) => ({
          title: tt.title,
          description: tt.description ?? null,
          priority: tt.priority as 'P0' | 'P1' | 'P2' | 'P3',
          position: tt.position,
          projectId: project.id,
          sectionId: sectionMap.get(tt.section) ?? defaultSectionId,
          createdById: ctx.userId,
        })),
      });
    }

    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: { sections: { orderBy: { position: 'asc' }, include: { tasks: { where: { parentId: null }, orderBy: { position: 'asc' } } } } },
    });
    return ok(fullProject);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== GitHub Tools ====================

export async function handleGitHubStatus(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const account = await prisma.account.findFirst({
      where: { userId: ctx.userId, provider: 'github' },
      select: { access_token: true },
    });
    if (!account?.access_token) return ok({ connected: false });

    let githubUsername: string | null = null;
    try {
      const data = await githubApi<{ login: string }>(account.access_token, '/user');
      githubUsername = data.login;
    } catch { /* ignore */ }

    return ok({ connected: true, githubUsername });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleGitHubRepos(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const token = await getGitHubToken(ctx.userId);
    const repos = await githubApi<{ id: number; full_name: string; name: string; owner: { login: string }; description: string | null; private: boolean; open_issues_count: number; has_issues: boolean }[]>(
      token, '/user/repos?per_page=100&sort=updated&type=all',
    );
    const filtered = repos.filter((r) => r.has_issues);

    const mappings = await prisma.gitHubRepoMapping.findMany({ where: { userId: ctx.userId } });
    const mappingMap = new Map(mappings.map((m) => [m.githubRepoFullName, m.projectId]));

    return ok({
      repos: filtered.map((r) => ({
        id: r.id, fullName: r.full_name, name: r.name, owner: r.owner.login,
        description: r.description, isPrivate: r.private, openIssuesCount: r.open_issues_count,
        mappedProjectId: mappingMap.get(r.full_name) ?? null,
      })),
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleGitHubIssues(
  params: { owner: string; repo: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const token = await getGitHubToken(ctx.userId);
    const fullName = `${params.owner}/${params.repo}`;
    const issues = await githubApi<{ number: number; node_id: string; title: string; body: string | null; state: string; labels: { name: string; color: string }[]; created_at: string; updated_at: string; pull_request?: unknown }[]>(
      token, `/repos/${fullName}/issues?state=open&per_page=100&sort=updated`,
    );
    const filtered = issues.filter((i) => !i.pull_request);

    const nodeIds = filtered.map((i) => i.node_id);
    const existingTasks = await prisma.task.findMany({
      where: { githubIssueNodeId: { in: nodeIds } },
      select: { id: true, githubIssueNodeId: true },
    });
    const existingMap = new Map(existingTasks.map((t) => [t.githubIssueNodeId, t.id]));

    return ok({
      issues: filtered.map((i) => ({
        number: i.number, nodeId: i.node_id, title: i.title, body: i.body, state: i.state,
        labels: i.labels.map((l) => ({ name: l.name, color: `#${l.color}` })),
        createdAt: i.created_at, updatedAt: i.updated_at,
        alreadyImported: existingMap.has(i.node_id),
        tasukeTaskId: existingMap.get(i.node_id) ?? null,
        checklistItems: parseChecklistItems(i.body),
      })),
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleGitHubMappingList(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const mappings = await prisma.gitHubRepoMapping.findMany({
      where: { userId: ctx.userId },
      include: { project: { select: { name: true, color: true } } },
    });
    return ok({ mappings });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleGitHubMappingSet(
  params: { githubRepoFullName: string; projectId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const mapping = await prisma.gitHubRepoMapping.upsert({
      where: { userId_githubRepoFullName: { userId: ctx.userId, githubRepoFullName: params.githubRepoFullName } },
      create: { userId: ctx.userId, githubRepoFullName: params.githubRepoFullName, projectId: params.projectId, workspaceId: ctx.workspaceId },
      update: { projectId: params.projectId, workspaceId: ctx.workspaceId },
    });
    return ok(mapping);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleGitHubSync(
  params: { githubRepoFullName: string; projectId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: ctx.workspaceId, userId: ctx.userId },
    });
    if (!membership) return err('アクセス権がありません');
    if (membership.role === 'VIEWER') return err('閲覧者は同期できません');

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, workspaceId: true },
    });
    if (!project || project.workspaceId !== ctx.workspaceId) return err('プロジェクトが見つかりません');

    const token = await getGitHubToken(ctx.userId);

    interface GHIssue { number: number; node_id: string; title: string; body: string | null; state: string; labels: { name: string; color: string }[]; assignees: { login: string }[]; pull_request?: unknown }
    const allIssues: GHIssue[] = [];
    let page = 1;
    while (true) {
      const batch = await githubApi<GHIssue[]>(token, `/repos/${params.githubRepoFullName}/issues?state=all&per_page=100&page=${page}&sort=created&direction=asc`);
      if (batch.length === 0) break;
      allIssues.push(...batch.filter((i) => !i.pull_request));
      if (batch.length < 100) break;
      page++;
    }

    const nodeIds = allIssues.map((i) => i.node_id);
    const existingTasks = await prisma.task.findMany({
      where: { githubIssueNodeId: { in: nodeIds } },
      select: { id: true, githubIssueNodeId: true, sectionId: true, completedAt: true },
    });
    const existingMap = new Map(existingTasks.map((t) => [t.githubIssueNodeId, t]));

    const firstSection = await prisma.section.findFirst({
      where: { projectId: params.projectId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    const defaultSectionId = firstSection?.id ?? null;

    const maxPos = await prisma.task.aggregate({
      where: { projectId: params.projectId },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? 0) + 1;
    let created = 0;
    let updated = 0;

    const BATCH_SIZE = 50;
    for (let i = 0; i < allIssues.length; i += BATCH_SIZE) {
      const batch = allIssues.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const issue of batch) {
          const existing = existingMap.get(issue.node_id);
          const status = issue.state === 'closed' ? 'DONE' as const : 'TODO' as const;
          if (existing) {
            await tx.task.update({
              where: { id: existing.id },
              data: {
                title: issue.title, description: issue.body ?? null, status,
                completedAt: status === 'DONE' ? (existing.completedAt ?? new Date()) : null,
                ...(existing.sectionId ? {} : { sectionId: defaultSectionId }),
                githubIssueSyncedAt: new Date(), githubSyncSource: 'github',
              },
            });
            updated++;
          } else {
            await tx.task.create({
              data: {
                title: issue.title, description: issue.body ?? null, status,
                completedAt: status === 'DONE' ? new Date() : null,
                projectId: params.projectId, sectionId: defaultSectionId,
                createdById: ctx.userId, position: position++,
                githubIssueId: issue.number, githubIssueNodeId: issue.node_id,
                githubRepoFullName: params.githubRepoFullName,
                githubIssueSyncedAt: new Date(), importedFromGitHub: true, githubSyncSource: 'github',
              },
            });
            created++;
          }
        }
      });
    }

    await prisma.gitHubRepoMapping.upsert({
      where: { userId_githubRepoFullName: { userId: ctx.userId, githubRepoFullName: params.githubRepoFullName } },
      update: { projectId: params.projectId, workspaceId: ctx.workspaceId },
      create: { userId: ctx.userId, githubRepoFullName: params.githubRepoFullName, projectId: params.projectId, workspaceId: ctx.workspaceId },
    });

    return ok({ total: allIssues.length, created, updated });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleGitHubImport(
  params: {
    issues: { githubIssueId: number; githubIssueNodeId: string; githubRepoFullName: string; title: string; body?: string | null; checklistItems?: { text: string; checked: boolean }[] }[];
    projectId: string;
    sectionId?: string | null;
    importSubtasks?: boolean;
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    if (params.issues.length > 50) return err('最大50件まで');

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { isPrivate: true, workspaceId: true },
    });
    if (!project) return err('プロジェクトが見つかりません');

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: ctx.userId },
    });
    if (!membership) return err('アクセス権がありません');
    if (membership.role === 'VIEWER') return err('閲覧者はインポートできません');

    let resolvedSectionId = params.sectionId ?? null;
    if (!resolvedSectionId) {
      const firstSection = await prisma.section.findFirst({
        where: { projectId: params.projectId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      resolvedSectionId = firstSection?.id ?? null;
    }

    const nodeIds = params.issues.map((i) => i.githubIssueNodeId);
    const existing = await prisma.task.findMany({
      where: { githubIssueNodeId: { in: nodeIds } },
      select: { githubIssueNodeId: true },
    });
    const existingSet = new Set(existing.map((t) => t.githubIssueNodeId));
    const toImport = params.issues.filter((i) => !existingSet.has(i.githubIssueNodeId));
    const skipped = params.issues.length - toImport.length;

    if (toImport.length === 0) return ok({ imported: 0, skipped });

    const maxPos = await prisma.task.aggregate({
      where: { projectId: params.projectId, sectionId: resolvedSectionId ?? undefined },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? 0) + 1;
    const importSubtasks = params.importSubtasks ?? true;

    const result = await prisma.$transaction(async (tx) => {
      const createdTasks = [];
      for (const issue of toImport) {
        const task = await tx.task.create({
          data: {
            title: issue.title, description: issue.body ?? null,
            projectId: params.projectId, sectionId: resolvedSectionId,
            createdById: ctx.userId, position: position++,
            githubIssueId: issue.githubIssueId, githubIssueNodeId: issue.githubIssueNodeId,
            githubRepoFullName: issue.githubRepoFullName,
            githubIssueSyncedAt: new Date(), importedFromGitHub: true, githubSyncSource: 'github',
            assignees: { create: [{ userId: ctx.userId }] },
          },
        });
        if (importSubtasks && issue.checklistItems && issue.checklistItems.length > 0) {
          let subPos = 1;
          for (const item of issue.checklistItems) {
            if (!item.text.trim()) continue;
            await tx.task.create({
              data: {
                title: item.text.trim(), parentId: task.id,
                projectId: params.projectId, sectionId: resolvedSectionId,
                createdById: ctx.userId, position: subPos++,
                status: item.checked ? 'DONE' : 'TODO',
                completedAt: item.checked ? new Date() : null,
              },
            });
          }
        }
        createdTasks.push(task);
      }
      return createdTasks;
    });

    return ok({ imported: result.length, skipped });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Google Tasks Tools ====================

export async function handleGTasksLists(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const auth = await getGoogleClient(ctx.userId);
    const tasksClient = getTasksClient(auth);
    const res = await tasksClient.tasklists.list({ maxResults: 100 });
    const lists = res.data.items ?? [];

    const mappings = await prisma.googleTaskListMapping.findMany({ where: { userId: ctx.userId } });
    const mappingMap = new Map(mappings.map((m) => [m.googleTaskListId, { projectId: m.projectId, workspaceId: m.workspaceId }]));

    return ok({
      lists: lists.map((l) => ({
        id: l.id, title: l.title, updated: l.updated,
        mappedProjectId: mappingMap.get(l.id!)?.projectId ?? null,
        mappedWorkspaceId: mappingMap.get(l.id!)?.workspaceId ?? null,
      })),
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleGTasksTasks(
  params: { listId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const auth = await getGoogleClient(ctx.userId);
    const tasksClient = getTasksClient(auth);
    const res = await tasksClient.tasks.list({ tasklist: params.listId, maxResults: 100, showCompleted: false });
    return ok(res.data.items ?? []);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleGTasksMappingSet(
  params: { googleTaskListId: string; googleTaskListName: string; projectId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const mapping = await prisma.googleTaskListMapping.upsert({
      where: { userId_googleTaskListId: { userId: ctx.userId, googleTaskListId: params.googleTaskListId } },
      create: { userId: ctx.userId, googleTaskListId: params.googleTaskListId, googleTaskListName: params.googleTaskListName, projectId: params.projectId, workspaceId: ctx.workspaceId },
      update: { projectId: params.projectId, googleTaskListName: params.googleTaskListName, workspaceId: ctx.workspaceId },
    });
    return ok(mapping);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleGTasksImport(
  params: {
    tasks: { googleTaskId: string; googleTaskListId: string; title: string; description?: string | null; dueDate?: string | null }[];
    projectId: string;
    sectionId?: string | null;
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    if (params.tasks.length > 50) return err('最大50件まで');

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { isPrivate: true, workspaceId: true },
    });
    if (!project) return err('プロジェクトが見つかりません');

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: ctx.userId },
    });
    if (!membership) return err('アクセス権がありません');
    if (membership.role === 'VIEWER') return err('閲覧者はインポートできません');

    const validTasks = params.tasks.filter((t) => t.title && t.title.trim().length > 0);
    if (validTasks.length === 0) return err('取り込み可能なタスクがありません');

    const googleTaskIds = validTasks.map((t) => t.googleTaskId);
    const existing = await prisma.task.findMany({
      where: { googleTaskId: { in: googleTaskIds } },
      select: { googleTaskId: true },
    });
    const existingSet = new Set(existing.map((t) => t.googleTaskId));
    const toImport = validTasks.filter((t) => !existingSet.has(t.googleTaskId));
    const skipped = params.tasks.length - toImport.length;

    if (toImport.length === 0) return ok({ imported: 0, skipped });

    const sectionId = params.sectionId ?? null;
    const maxPos = await prisma.task.aggregate({
      where: { projectId: params.projectId, sectionId: sectionId ?? undefined },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? 0) + 1;

    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const t of toImport) {
        const task = await tx.task.create({
          data: {
            title: t.title.trim(), description: t.description ?? null,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            projectId: params.projectId, sectionId,
            createdById: ctx.userId, position: position++,
            googleTaskId: t.googleTaskId, googleTaskListId: t.googleTaskListId,
            googleTaskSyncedAt: new Date(), importedFromGoogle: true,
            assignees: { create: [{ userId: ctx.userId }] },
          },
        });
        created.push(task);
      }
      return created;
    });

    return ok({ imported: result.length, skipped });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Settings Tools ====================

export async function handleApiTokenList(
  _params: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const tokens = await prisma.apiToken.findMany({
      where: { userId: ctx.userId, revokedAt: null },
      select: { id: true, name: true, tokenPrefix: true, scope: true, lastUsedAt: true, expiresAt: true, createdAt: true, workspace: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(tokens);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleApiTokenCreate(
  params: { name: string; scope?: string; expiresInDays?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const rawToken = generateApiToken();
    const tokenHash = hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 12) + '...';
    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const token = await prisma.apiToken.create({
      data: {
        name: params.name,
        tokenHash,
        tokenPrefix,
        scope: params.scope ?? 'read_write',
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        expiresAt,
      },
    });

    return ok({
      id: token.id, name: token.name, token: rawToken,
      tokenPrefix, scope: token.scope, expiresAt: token.expiresAt, createdAt: token.createdAt,
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleApiTokenRevoke(
  params: { tokenId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const token = await prisma.apiToken.findFirst({ where: { id: params.tokenId, userId: ctx.userId } });
    if (!token) return err('トークンが見つかりません');

    await prisma.apiToken.update({ where: { id: params.tokenId }, data: { revokedAt: new Date() } });
    return ok({ success: true });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleProjectSettingsUpdate(
  params: { projectId: string; isPrivate: boolean },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const project = await prisma.project.findFirst({
      where: { id: params.projectId, workspace: { members: { some: { userId: ctx.userId } } } },
      select: { id: true, isPrivate: true, workspaceId: true },
    });
    if (!project) return err('プロジェクトが見つかりません');

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: ctx.userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!membership) return err('OWNER/ADMINのみ設定を変更できます');

    if (params.isPrivate && !project.isPrivate) {
      const wsMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: project.workspaceId },
        select: { userId: true },
      });
      const existingPMs = await prisma.projectMember.findMany({
        where: { projectId: params.projectId },
        select: { userId: true },
      });
      const existingIds = new Set(existingPMs.map((pm) => pm.userId));
      const toAdd = wsMembers.filter((m) => !existingIds.has(m.userId));
      if (toAdd.length > 0) {
        await prisma.projectMember.createMany({
          data: toAdd.map((m) => ({ projectId: params.projectId, userId: m.userId })),
        });
      }
    }

    const updated = await prisma.project.update({
      where: { id: params.projectId },
      data: { isPrivate: params.isPrivate },
    });
    return ok(updated);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleProjectReorder(
  params: { projectIds: string[] },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    await prisma.$transaction(
      params.projectIds.map((id, index) =>
        prisma.project.update({
          where: { id, workspaceId: ctx.workspaceId },
          data: { position: index },
        }),
      ),
    );
    return ok({ success: true });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleProjectMemberList(
  params: { projectId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const project = await prisma.project.findFirst({
      where: { id: params.projectId, workspace: { members: { some: { userId: ctx.userId } } } },
      select: { id: true },
    });
    if (!project) return err('プロジェクトが見つかりません');

    const members = await prisma.projectMember.findMany({
      where: { projectId: params.projectId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { addedAt: 'asc' },
    });
    return ok(members);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ==================== Meeting Tools ====================

export async function handleMeetingList(
  params: { status?: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const meetings = await prisma.meeting.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(params.status ? { status: params.status as 'EXTRACTING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FAILED' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
      select: {
        id: true,
        title: true,
        status: true,
        source: true,
        meetingDate: true,
        createdAt: true,
        approvedAt: true,
        failureReason: true,
        _count: { select: { extractedTasks: true } },
      },
    });
    return ok(meetings);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleMeetingGet(
  params: { meetingId: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const meeting = await prisma.meeting.findFirst({
      where: { id: params.meetingId, workspaceId: ctx.workspaceId },
      include: {
        extractedTasks: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!meeting) return err('議事録が見つかりません');
    return ok(meeting);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleExtractedTaskUpdate(
  params: {
    extractedTaskId: string;
    finalTitle?: string;
    finalDescription?: string | null;
    finalAssigneeId?: string | null;
    finalProjectId?: string | null;
    finalSectionId?: string | null;
    finalDueDate?: string | null;
    finalPriority?: 'P0' | 'P1' | 'P2' | 'P3';
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const et = await prisma.extractedTask.findUnique({
      where: { id: params.extractedTaskId },
      select: { id: true, status: true, meeting: { select: { workspaceId: true } } },
    });
    if (!et) return err('抽出タスクが見つかりません');
    if (et.meeting.workspaceId !== ctx.workspaceId) return err('アクセス権がありません');
    if (et.status === 'APPROVED') return err('承認済みのため編集できません');

    const updated = await prisma.extractedTask.update({
      where: { id: params.extractedTaskId },
      data: {
        finalTitle: params.finalTitle ?? undefined,
        finalDescription: params.finalDescription ?? undefined,
        finalAssigneeId: params.finalAssigneeId ?? undefined,
        finalProjectId: params.finalProjectId ?? undefined,
        finalSectionId: params.finalSectionId ?? undefined,
        finalDueDate: params.finalDueDate ? new Date(params.finalDueDate) : undefined,
        finalPriority: params.finalPriority ?? undefined,
      },
    });
    return ok(updated);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function handleMeetingApprove(
  params: {
    meetingId: string;
    items: { extractedTaskId: string; action: 'approve' | 'reject' }[];
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const meeting = await prisma.meeting.findFirst({
      where: { id: params.meetingId, workspaceId: ctx.workspaceId },
      include: { extractedTasks: true },
    });
    if (!meeting) return err('議事録が見つかりません');
    if (meeting.status === 'APPROVED') return err('既に承認済みです');

    const etById = new Map(meeting.extractedTasks.map((et) => [et.id, et]));

    const projectIds = new Set(
      (
        await prisma.project.findMany({
          where: { workspaceId: ctx.workspaceId },
          select: { id: true },
        })
      ).map((p) => p.id),
    );
    const memberUserIds = new Set(
      (
        await prisma.workspaceMember.findMany({
          where: { workspaceId: ctx.workspaceId },
          select: { userId: true },
        })
      ).map((m) => m.userId),
    );

    const approved: { extractedTaskId: string; createdTaskId: string }[] = [];
    const rejected: string[] = [];
    const skipped: { extractedTaskId: string; reason: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of params.items) {
        const et = etById.get(item.extractedTaskId);
        if (!et) {
          skipped.push({ extractedTaskId: item.extractedTaskId, reason: 'not found' });
          continue;
        }
        if (et.status !== 'PENDING') {
          skipped.push({ extractedTaskId: et.id, reason: `already ${et.status}` });
          continue;
        }

        if (item.action === 'reject') {
          await tx.extractedTask.update({
            where: { id: et.id },
            data: { status: 'REJECTED' },
          });
          rejected.push(et.id);
          continue;
        }

        const finalTitle = et.finalTitle ?? et.suggestedTitle;
        const finalProjectId = et.finalProjectId ?? et.suggestedProjectId;
        const finalAssigneeId = et.finalAssigneeId ?? et.suggestedAssigneeId;
        const finalDueDate = et.finalDueDate ?? et.suggestedDueDate;
        const finalPriority = et.finalPriority ?? et.suggestedPriority;

        if (!finalProjectId || !projectIds.has(finalProjectId)) {
          skipped.push({ extractedTaskId: et.id, reason: 'projectIdが未設定または無効' });
          continue;
        }
        if (finalAssigneeId && !memberUserIds.has(finalAssigneeId)) {
          skipped.push({ extractedTaskId: et.id, reason: 'assigneeIdがworkspaceメンバーでない' });
          continue;
        }

        const created = await tx.task.create({
          data: {
            title: finalTitle,
            description: et.finalDescription ?? et.suggestedDescription ?? null,
            priority: finalPriority,
            projectId: finalProjectId,
            sectionId: et.finalSectionId ?? null,
            createdById: ctx.userId,
            dueDate: finalDueDate ?? null,
            assignees: finalAssigneeId
              ? { create: [{ userId: finalAssigneeId }] }
              : undefined,
          },
          select: { id: true },
        });

        await tx.extractedTask.update({
          where: { id: et.id },
          data: {
            status: 'APPROVED',
            createdTaskId: created.id,
            finalTitle,
            finalAssigneeId: finalAssigneeId ?? null,
            finalProjectId,
            finalSectionId: et.finalSectionId ?? null,
            finalDueDate: finalDueDate ?? null,
            finalPriority,
          },
        });
        approved.push({ extractedTaskId: et.id, createdTaskId: created.id });
      }

      const remaining = await tx.extractedTask.count({
        where: { meetingId: meeting.id, status: 'PENDING' },
      });
      if (remaining === 0) {
        await tx.meeting.update({
          where: { id: meeting.id },
          data: { status: 'APPROVED', approvedAt: new Date() },
        });
      }
    });

    return ok({ approved, rejected, skipped });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
