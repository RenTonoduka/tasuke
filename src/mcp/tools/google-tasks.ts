import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleGTasksLists,
  handleGTasksTasks,
  handleGTasksMappingSet,
  handleGTasksImport,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerGoogleTasksTools(server: McpServer) {
  server.tool(
    'gtasks_lists',
    'Google Tasksのリスト一覧を取得します',
    {},
    async () => handleGTasksLists({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'gtasks_tasks',
    'Google Tasksのタスク一覧を取得します',
    { listId: z.string().describe('タスクリストID') },
    async (params) => handleGTasksTasks(params, await getCtx()),
  );

  server.tool(
    'gtasks_mapping_set',
    'Google TasksリストとプロジェクトのマッピングID設定',
    {
      googleTaskListId: z.string().describe('Google TasksリストID'),
      googleTaskListName: z.string().describe('リスト名'),
      projectId: z.string().describe('プロジェクトID'),
    },
    async (params) => handleGTasksMappingSet(params, await getCtx()),
  );

  server.tool(
    'gtasks_import',
    'Google Tasksのタスクをインポートします',
    {
      tasks: z.array(z.object({
        googleTaskId: z.string().describe('Google TaskのID'),
        googleTaskListId: z.string().describe('リストID'),
        title: z.string().describe('タイトル'),
        description: z.string().optional().nullable().describe('説明'),
        dueDate: z.string().optional().nullable().describe('期限（ISO8601）'),
      })).min(1).max(50).describe('インポートするタスク配列'),
      projectId: z.string().describe('インポート先プロジェクトID'),
      sectionId: z.string().optional().nullable().describe('セクションID'),
    },
    async (params) => handleGTasksImport(params, await getCtx()),
  );
}
