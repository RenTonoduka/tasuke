import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleDashboard,
  handleMyTasks,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerDashboardTools(server: McpServer) {

  server.tool(
    'dashboard',
    '期限切れ・今日期限・今週期限・進行中タスクをまとめて取得します',
    {},
    async () => handleDashboard({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'my_tasks',
    '自分にアサインされたタスク一覧を取得します',
    {
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional().describe('ステータスフィルタ'),
      limit: z.number().optional().describe('取得件数（デフォルト30）'),
    },
    async (params) => handleMyTasks(params, await getCtx()),
  );
}
