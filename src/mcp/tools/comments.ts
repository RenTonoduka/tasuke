import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma, getDefaultUser } from '../context.js';
import { ok, err } from '../helpers.js';

export function registerCommentTools(server: McpServer) {

  server.tool(
    'comment_list',
    'タスクのコメント一覧を取得します',
    {
      taskId: z.string().describe('タスクID'),
      limit: z.number().optional().describe('取得件数（デフォルト20）'),
    },
    async (params) => {
      try {
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
  );

  server.tool(
    'comment_add',
    'タスクにコメントを追加します',
    {
      taskId: z.string().describe('タスクID'),
      content: z.string().describe('コメント内容'),
    },
    async ({ taskId, content }) => {
      try {
        const userId = await getDefaultUser();
        const comment = await prisma.comment.create({
          data: { taskId, content, userId },
          include: { user: { select: { id: true, name: true } } },
        });
        return ok(comment);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );
}
