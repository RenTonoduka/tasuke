import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleTaskList,
  handleTaskCreate,
  handleTaskUpdate,
  handleTaskDelete,
  handleTaskMove,
  handleTaskSearch,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerTaskTools(server: McpServer) {

  server.tool(
    'task_list',
    'タスク一覧を取得します',
    {
      projectId: z.string().optional().describe('プロジェクトID'),
      sectionId: z.string().optional().describe('セクションID'),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional().describe('ステータス'),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('優先度'),
      dueBefore: z.string().optional().describe('この日付より前に期限のタスク（ISO8601）'),
      dueAfter: z.string().optional().describe('この日付より後に期限のタスク（ISO8601）'),
      limit: z.number().optional().describe('取得件数（デフォルト50）'),
    },
    async (params) => handleTaskList(params, await getCtx()),
  );

  server.tool(
    'task_create',
    'タスクを作成します',
    {
      title: z.string().describe('タスクタイトル'),
      projectId: z.string().describe('プロジェクトID'),
      sectionId: z.string().optional().describe('セクションID'),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('優先度（デフォルトP3）'),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional().describe('ステータス（デフォルトTODO）'),
      dueDate: z.string().optional().describe('期限（ISO8601）'),
      description: z.string().optional().describe('説明'),
      estimatedHours: z.number().optional().describe('見積もり時間（時間単位）'),
    },
    async (params) => handleTaskCreate(params, await getCtx()),
  );

  server.tool(
    'task_update',
    'タスクを更新します',
    {
      taskId: z.string().describe('タスクID'),
      title: z.string().optional().describe('タイトル'),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional().describe('ステータス'),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('優先度'),
      startDate: z.string().optional().nullable().describe('開始日（ISO8601 or null）'),
      dueDate: z.string().optional().nullable().describe('期限（ISO8601 or null）'),
      estimatedHours: z.number().optional().nullable().describe('見積もり時間'),
      description: z.string().optional().nullable().describe('説明'),
      sectionId: z.string().optional().nullable().describe('セクションID'),
    },
    async (params) => handleTaskUpdate(params, await getCtx()),
  );

  server.tool(
    'task_delete',
    'タスクを削除します',
    { taskId: z.string().describe('タスクID') },
    async (params) => handleTaskDelete(params, await getCtx()),
  );

  server.tool(
    'task_move',
    'タスクを別のセクションに移動します',
    {
      taskId: z.string().describe('タスクID'),
      sectionId: z.string().nullable().describe('移動先セクションID（nullでセクション未所属）'),
      position: z.number().optional().describe('表示位置（省略時は末尾）'),
    },
    async (params) => handleTaskMove(params, await getCtx()),
  );

  server.tool(
    'task_search',
    'タスクをキーワード検索します',
    {
      query: z.string().describe('検索キーワード'),
      limit: z.number().optional().describe('取得件数（デフォルト20）'),
    },
    async (params) => handleTaskSearch(params, await getCtx()),
  );
}
