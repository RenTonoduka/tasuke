import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleAutomationList,
  handleAutomationCreate,
  handleAutomationUpdate,
  handleAutomationDelete,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerAutomationTools(server: McpServer) {
  server.tool(
    'automation_list',
    'プロジェクトの自動化ルール一覧を取得します',
    { projectId: z.string().describe('プロジェクトID') },
    async (params) => handleAutomationList(params, await getCtx()),
  );

  server.tool(
    'automation_create',
    '自動化ルールを作成します',
    {
      projectId: z.string().describe('プロジェクトID'),
      name: z.string().describe('ルール名'),
      trigger: z.record(z.string(), z.unknown()).describe('トリガー条件（JSON）'),
      action: z.record(z.string(), z.unknown()).describe('アクション（JSON）'),
    },
    async (params) => handleAutomationCreate(params, await getCtx()),
  );

  server.tool(
    'automation_update',
    '自動化ルールを更新します',
    {
      ruleId: z.string().describe('ルールID'),
      name: z.string().optional().describe('ルール名'),
      enabled: z.boolean().optional().describe('有効/無効'),
      trigger: z.record(z.string(), z.unknown()).optional().describe('トリガー条件（JSON）'),
      action: z.record(z.string(), z.unknown()).optional().describe('アクション（JSON）'),
    },
    async (params) => handleAutomationUpdate(params, await getCtx()),
  );

  server.tool(
    'automation_delete',
    '自動化ルールを削除します',
    { ruleId: z.string().describe('ルールID') },
    async (params) => handleAutomationDelete(params, await getCtx()),
  );
}
