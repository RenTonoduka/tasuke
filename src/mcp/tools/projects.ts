import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleProjectList,
  handleProjectCreate,
  handleProjectUpdate,
  handleProjectDelete,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerProjectTools(server: McpServer) {

  server.tool(
    'project_list',
    'プロジェクト一覧を取得します',
    {},
    async () => handleProjectList({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'project_create',
    'プロジェクトを作成します（Todo/進行中/完了セクション自動作成）',
    {
      name: z.string().describe('プロジェクト名'),
      color: z.string().optional().describe('色（HEX, デフォルト #4285F4）'),
      description: z.string().optional().describe('説明'),
    },
    async (params) => handleProjectCreate(params, await getCtx()),
  );

  server.tool(
    'project_update',
    'プロジェクトを更新します',
    {
      projectId: z.string().describe('プロジェクトID'),
      name: z.string().optional().describe('プロジェクト名'),
      color: z.string().optional().describe('色（HEX）'),
      description: z.string().optional().nullable().describe('説明'),
    },
    async (params) => handleProjectUpdate(params, await getCtx()),
  );

  server.tool(
    'project_delete',
    'プロジェクトを削除します（配下のタスク・セクションも全削除）',
    { projectId: z.string().describe('プロジェクトID') },
    async (params) => handleProjectDelete(params, await getCtx()),
  );
}
