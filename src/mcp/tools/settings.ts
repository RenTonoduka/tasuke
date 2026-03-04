import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleApiTokenList,
  handleApiTokenCreate,
  handleApiTokenRevoke,
  handleProjectSettingsUpdate,
  handleProjectReorder,
  handleProjectMemberList,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerSettingsTools(server: McpServer) {
  server.tool(
    'api_token_list',
    'APIトークン一覧を取得します',
    {},
    async () => handleApiTokenList({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'api_token_create',
    'APIトークンを発行します（トークンは1回のみ表示）',
    {
      name: z.string().describe('トークン名'),
      scope: z.enum(['read_only', 'read_write']).optional().describe('スコープ（デフォルトread_write）'),
      expiresInDays: z.number().optional().describe('有効期限（日数）'),
    },
    async (params) => handleApiTokenCreate(params, await getCtx()),
  );

  server.tool(
    'api_token_revoke',
    'APIトークンを無効化します',
    { tokenId: z.string().describe('トークンID') },
    async (params) => handleApiTokenRevoke(params, await getCtx()),
  );

  server.tool(
    'project_settings_update',
    'プロジェクトの公開/非公開設定を変更します',
    {
      projectId: z.string().describe('プロジェクトID'),
      isPrivate: z.boolean().describe('非公開にするかどうか'),
    },
    async (params) => handleProjectSettingsUpdate(params, await getCtx()),
  );

  server.tool(
    'project_reorder',
    'プロジェクトの表示順を変更します',
    {
      projectIds: z.array(z.string()).min(1).describe('プロジェクトIDの配列（表示順）'),
    },
    async (params) => handleProjectReorder(params, await getCtx()),
  );

  server.tool(
    'project_member_list',
    'プロジェクトのメンバー一覧を取得します',
    { projectId: z.string().describe('プロジェクトID') },
    async (params) => handleProjectMemberList(params, await getCtx()),
  );
}
