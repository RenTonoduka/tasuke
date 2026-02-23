import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma, getDefaultUser, getDefaultWorkspace } from '../context.js';
import { ok, err } from '../helpers.js';

export function registerDashboardTools(server: McpServer) {

  server.tool(
    'dashboard',
    '期限切れ・今日期限・今週期限・進行中タスクをまとめて取得します',
    {},
    async () => {
      try {
        const workspaceId = await getDefaultWorkspace();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const weekEnd = new Date(todayStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const baseWhere = {
          project: { workspaceId },
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
  );

  server.tool(
    'my_tasks',
    '自分にアサインされたタスク一覧を取得します',
    {
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional().describe('ステータスフィルタ'),
      limit: z.number().optional().describe('取得件数（デフォルト30）'),
    },
    async (params) => {
      try {
        const userId = await getDefaultUser();
        const tasks = await prisma.task.findMany({
          where: {
            parentId: null,
            assignees: { some: { userId } },
            ...(params.status && { status: params.status }),
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
  );
}
