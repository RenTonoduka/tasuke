import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma, getDefaultUser } from '../context.js';
import { ok, err } from '../helpers.js';

export function registerTaskTools(server: McpServer) {

  server.tool(
    'task_list',
    'タスク一覧を取得します',
    {
      projectId: z.string().optional().describe('プロジェクトID'),
      sectionId: z.string().optional().describe('セクションID'),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional().describe('ステータス'),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('優先度'),
      dueBefore: z.string().optional().describe('この日付より前に期限のタスク（ISO8601）'),
      dueAfter: z.string().optional().describe('この日付より後に期限のタスク（ISO8601）'),
      limit: z.number().optional().describe('取得件数（デフォルト50）'),
    },
    async (params) => {
      try {
        const dueDate: Record<string, Date> = {};
        if (params.dueBefore) dueDate.lt = new Date(params.dueBefore);
        if (params.dueAfter) dueDate.gte = new Date(params.dueAfter);

        const tasks = await prisma.task.findMany({
          where: {
            parentId: null,
            ...(params.projectId && { projectId: params.projectId }),
            ...(params.sectionId && { sectionId: params.sectionId }),
            ...(params.status && { status: params.status }),
            ...(params.priority && { priority: params.priority }),
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
  );

  server.tool(
    'task_create',
    'タスクを作成します',
    {
      title: z.string().describe('タスクタイトル'),
      projectId: z.string().describe('プロジェクトID'),
      sectionId: z.string().optional().describe('セクションID'),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('優先度（デフォルトP3）'),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional().describe('ステータス（デフォルトTODO）'),
      dueDate: z.string().optional().describe('期限（ISO8601）'),
      description: z.string().optional().describe('説明'),
      estimatedHours: z.number().optional().describe('見積もり時間（時間単位）'),
    },
    async (params) => {
      try {
        const userId = await getDefaultUser();

        // セクション未指定の場合、プロジェクトの最初のセクションを使う
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
            priority: params.priority ?? 'P3',
            status: params.status ?? 'TODO',
            dueDate: params.dueDate ? new Date(params.dueDate) : null,
            description: params.description ?? null,
            estimatedHours: params.estimatedHours ?? null,
            position: (maxPos._max.position ?? 0) + 1,
            createdById: userId,
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
  );

  server.tool(
    'task_update',
    'タスクを更新します',
    {
      taskId: z.string().describe('タスクID'),
      title: z.string().optional().describe('タイトル'),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional().describe('ステータス'),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('優先度'),
      startDate: z.string().optional().nullable().describe('開始日（ISO8601 or null）'),
      dueDate: z.string().optional().nullable().describe('期限（ISO8601 or null）'),
      estimatedHours: z.number().optional().nullable().describe('見積もり時間'),
      description: z.string().optional().nullable().describe('説明'),
      sectionId: z.string().optional().nullable().describe('セクションID'),
    },
    async (params) => {
      try {
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

        const task = await prisma.task.update({
          where: { id: taskId },
          data: updateData,
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
  );

  server.tool(
    'task_delete',
    'タスクを削除します',
    {
      taskId: z.string().describe('タスクID'),
    },
    async ({ taskId }) => {
      try {
        await prisma.task.delete({ where: { id: taskId } });
        return ok({ success: true, deletedId: taskId });
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'task_move',
    'タスクを別のセクションに移動します',
    {
      taskId: z.string().describe('タスクID'),
      sectionId: z.string().nullable().describe('移動先セクションID（nullでセクション未所属）'),
      position: z.number().optional().describe('表示位置（省略時は末尾）'),
    },
    async (params) => {
      try {
        let position = params.position;
        if (position === undefined) {
          const maxPos = await prisma.task.aggregate({
            where: { sectionId: params.sectionId },
            _max: { position: true },
          });
          position = (maxPos._max.position ?? 0) + 1;
        }

        const task = await prisma.task.update({
          where: { id: params.taskId },
          data: { sectionId: params.sectionId, position },
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
  );

  server.tool(
    'task_search',
    'タスクをキーワード検索します',
    {
      query: z.string().describe('検索キーワード'),
      limit: z.number().optional().describe('取得件数（デフォルト20）'),
    },
    async (params) => {
      try {
        const tasks = await prisma.task.findMany({
          where: {
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
  );
}
