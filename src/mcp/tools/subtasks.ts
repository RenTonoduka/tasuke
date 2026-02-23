import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma, getDefaultUser } from '../context.js';
import { ok, err } from '../helpers.js';

export function registerSubtaskTools(server: McpServer) {

  server.tool(
    'subtask_list',
    '親タスクのサブタスク一覧を取得します',
    {
      taskId: z.string().describe('親タスクID'),
    },
    async ({ taskId }) => {
      try {
        const subtasks = await prisma.task.findMany({
          where: { parentId: taskId },
          select: { id: true, title: true, status: true, priority: true, dueDate: true, position: true },
          orderBy: { position: 'asc' },
        });
        return ok(subtasks);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'subtask_create',
    'サブタスクを作成します',
    {
      parentId: z.string().describe('親タスクID'),
      title: z.string().describe('サブタスクタイトル'),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('優先度（デフォルトP3）'),
      dueDate: z.string().optional().describe('期限（ISO8601）'),
    },
    async (params) => {
      try {
        const userId = await getDefaultUser();
        const parent = await prisma.task.findUnique({
          where: { id: params.parentId },
          select: { projectId: true, sectionId: true },
        });
        if (!parent) return err('親タスクが見つかりません');

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
            priority: params.priority ?? 'P3',
            dueDate: params.dueDate ? new Date(params.dueDate) : null,
            position: (maxPos._max.position ?? 0) + 1,
            createdById: userId,
          },
        });
        return ok(subtask);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'subtask_toggle',
    'サブタスクの完了/未完了を切り替えます',
    {
      subtaskId: z.string().describe('サブタスクID'),
    },
    async ({ subtaskId }) => {
      try {
        const task = await prisma.task.findUnique({
          where: { id: subtaskId },
          select: { status: true },
        });
        if (!task) return err('サブタスクが見つかりません');

        const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
        const updated = await prisma.task.update({
          where: { id: subtaskId },
          data: {
            status: newStatus,
            completedAt: newStatus === 'DONE' ? new Date() : null,
          },
        });
        return ok(updated);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );
}
