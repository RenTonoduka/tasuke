import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleWorkspaceList,
  handleWorkspaceCreate,
  handleWorkspaceUpdate,
  handleWorkspaceDelete,
  handleWorkspaceStats,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerWorkspaceTools(server: McpServer) {
  server.tool(
    'workspace_list',
    'ワークスペース一覧を取得します',
    {},
    async () => handleWorkspaceList({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'workspace_create',
    'ワークスペースを作成します',
    { name: z.string().describe('ワークスペース名') },
    async (params) => handleWorkspaceCreate(params, await getCtx()),
  );

  server.tool(
    'workspace_update',
    'ワークスペース名を更新します',
    {
      workspaceId: z.string().describe('ワークスペースID'),
      name: z.string().describe('新しいワークスペース名'),
    },
    async (params) => handleWorkspaceUpdate(params, await getCtx()),
  );

  server.tool(
    'workspace_delete',
    'ワークスペースを削除します（オーナーのみ）',
    { workspaceId: z.string().describe('ワークスペースID') },
    async (params) => handleWorkspaceDelete(params, await getCtx()),
  );

  server.tool(
    'workspace_stats',
    'ワークスペースのタスク統計を取得します',
    { workspaceId: z.string().optional().describe('ワークスペースID（省略時はデフォルト）') },
    async (params) => handleWorkspaceStats(params, await getCtx()),
  );
}
