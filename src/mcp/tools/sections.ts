import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleSectionList,
  handleSectionCreate,
  handleSectionUpdate,
  handleSectionDelete,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerSectionTools(server: McpServer) {

  server.tool(
    'section_list',
    'プロジェクトのセクション一覧を取得します',
    { projectId: z.string().describe('プロジェクトID') },
    async (params) => handleSectionList(params, await getCtx()),
  );

  server.tool(
    'section_create',
    'セクションを作成します',
    {
      projectId: z.string().describe('プロジェクトID'),
      name: z.string().describe('セクション名'),
    },
    async (params) => handleSectionCreate(params, await getCtx()),
  );

  server.tool(
    'section_update',
    'セクション名を更新します',
    {
      sectionId: z.string().describe('セクションID'),
      name: z.string().describe('新しいセクション名'),
    },
    async (params) => handleSectionUpdate(params, await getCtx()),
  );

  server.tool(
    'section_delete',
    'セクションを削除します（配下のタスクはセクション未所属になります）',
    {
      sectionId: z.string().describe('セクションID'),
    },
    async (params) => handleSectionDelete(params, await getCtx()),
  );
}
