import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleMemberList,
  handleMemberInvite,
  handleMemberRemove,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerMemberTools(server: McpServer) {
  server.tool(
    'member_list',
    'ワークスペースのメンバー一覧を取得します',
    { workspaceId: z.string().optional().describe('ワークスペースID（省略時はデフォルト）') },
    async (params) => handleMemberList(params, await getCtx()),
  );

  server.tool(
    'member_invite',
    'メールアドレスでメンバーを招待します',
    {
      email: z.string().email().describe('招待するメールアドレス'),
      role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional().describe('ロール（デフォルトMEMBER）'),
    },
    async (params) => handleMemberInvite(params, await getCtx()),
  );

  server.tool(
    'member_remove',
    'メンバーを削除します',
    { memberId: z.string().describe('ワークスペースメンバーID') },
    async (params) => handleMemberRemove(params, await getCtx()),
  );
}
