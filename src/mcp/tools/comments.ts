import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleCommentList,
  handleCommentAdd,
  handleCommentUpdate,
  handleCommentDelete,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerCommentTools(server: McpServer) {

  server.tool(
    'comment_list',
    'タスクのコメント一覧を取得します',
    {
      taskId: z.string().describe('タスクID'),
      limit: z.number().optional().describe('取得件数（デフォルト20）'),
    },
    async (params) => handleCommentList(params, await getCtx()),
  );

  server.tool(
    'comment_add',
    'タスクにコメントを追加します',
    {
      taskId: z.string().describe('タスクID'),
      content: z.string().describe('コメント内容'),
    },
    async (params) => handleCommentAdd(params, await getCtx()),
  );

  server.tool(
    'comment_update',
    'コメントを編集します（自分のコメントのみ）',
    {
      commentId: z.string().describe('コメントID'),
      content: z.string().describe('新しいコメント内容'),
    },
    async (params) => handleCommentUpdate(params, await getCtx()),
  );

  server.tool(
    'comment_delete',
    'コメントを削除します（自分のコメントのみ）',
    {
      commentId: z.string().describe('コメントID'),
    },
    async (params) => handleCommentDelete(params, await getCtx()),
  );
}
