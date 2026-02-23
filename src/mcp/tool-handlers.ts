import prisma from '@/lib/prisma';
import { getAccessibleProjectIds } from '@/lib/project-access';

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
  params: { taskId: string; sectionId: string | null; position?: number },
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

    let position = params.position;
    if (position === undefined) {
      const maxPos = await prisma.task.aggregate({
        where: { sectionId: params.sectionId },
        _max: { position: true },
      });
      position = (maxPos._max.position ?? 0) + 1;
    }

    const updated = await prisma.task.update({
      where: { id: params.taskId },
      data: { sectionId: params.sectionId, position },
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
            { name: 'Todo', position: 0 },
            { name: '進行中', position: 1 },
            { name: '完了', position: 2 },
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
