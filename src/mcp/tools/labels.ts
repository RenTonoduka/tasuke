import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleLabelList,
  handleLabelCreate,
  handleLabelUpdate,
  handleLabelDelete,
  handleTaskLabelSet,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerLabelTools(server: McpServer) {

  server.tool(
    'label_list',
    'ワークスペースのラベル一覧を取得します',
    {},
    async () => handleLabelList({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'label_create',
    'ラベルを作成します',
    {
      name: z.string().describe('ラベル名'),
      color: z.string().optional().describe('色（HEX, デフォルト #4285F4）'),
    },
    async (params) => handleLabelCreate(params, await getCtx()),
  );

  server.tool(
    'label_update',
    'ラベルの名前や色を更新します',
    {
      labelId: z.string().describe('ラベルID'),
      name: z.string().optional().describe('新しいラベル名'),
      color: z.string().optional().describe('新しい色（HEX）'),
    },
    async (params) => handleLabelUpdate(params, await getCtx()),
  );

  server.tool(
    'label_delete',
    'ラベルを削除します（関連 TaskLabel は自動削除）',
    {
      labelId: z.string().describe('削除するラベルID'),
    },
    async (params) => handleLabelDelete(params, await getCtx()),
  );

  server.tool(
    'task_label_set',
    'タスクのラベルを設定します（既存ラベルは置換）',
    {
      taskId: z.string().describe('タスクID'),
      labelIds: z.array(z.string()).describe('設定するラベルIDの配列（空配列で全解除）'),
    },
    async (params) => handleTaskLabelSet(params, await getCtx()),
  );
}
