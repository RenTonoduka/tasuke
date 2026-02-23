import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleSubtaskList,
  handleSubtaskCreate,
  handleSubtaskToggle,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerSubtaskTools(server: McpServer) {

  server.tool(
    'subtask_list',
    '親タスクのサブタスク一覧を取得します',
    { taskId: z.string().describe('親タスクID') },
    async (params) => handleSubtaskList(params, await getCtx()),
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
    async (params) => handleSubtaskCreate(params, await getCtx()),
  );

  server.tool(
    'subtask_toggle',
    'サブタスクの完了/未完了を切り替えます',
    { subtaskId: z.string().describe('サブタスクID') },
    async (params) => handleSubtaskToggle(params, await getCtx()),
  );
}
