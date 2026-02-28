import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleNotificationList,
  handleNotificationRead,
  handleNotificationReadAll,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerNotificationTools(server: McpServer) {

  server.tool(
    'notification_list',
    '通知一覧を取得します',
    {
      unreadOnly: z.boolean().optional().describe('未読のみ取得（デフォルトfalse）'),
      limit: z.number().optional().describe('取得件数（デフォルト50）'),
    },
    async (params) => handleNotificationList(params, await getCtx()),
  );

  server.tool(
    'notification_read',
    '通知を既読にします',
    {
      notificationId: z.string().describe('通知ID'),
    },
    async (params) => handleNotificationRead(params, await getCtx()),
  );

  server.tool(
    'notification_read_all',
    '全ての未読通知を既読にします',
    {},
    async () => handleNotificationReadAll({}, await getCtx()),
  );
}
