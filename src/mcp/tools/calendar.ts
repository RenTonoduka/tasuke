import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleCalendarEventList,
  handleCalendarEventCreate,
  handleCalendarEventUpdate,
  handleCalendarEventDelete,
  handleScheduleBlockList,
  handleScheduleBlockCreate,
  handleScheduleBlockDelete,
  handleScheduleSuggest,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerCalendarTools(server: McpServer) {
  server.tool(
    'calendar_event_list',
    'Googleカレンダーのイベント一覧を取得します',
    {
      timeMin: z.string().describe('取得開始日時（ISO8601）'),
      timeMax: z.string().describe('取得終了日時（ISO8601）'),
    },
    async (params) => handleCalendarEventList(params, await getCtx()),
  );

  server.tool(
    'calendar_event_create',
    'Googleカレンダーにイベントを作成します',
    {
      summary: z.string().optional().describe('イベントタイトル'),
      start: z.string().describe('開始日時（ISO8601）'),
      end: z.string().describe('終了日時（ISO8601）'),
    },
    async (params) => handleCalendarEventCreate(params, await getCtx()),
  );

  server.tool(
    'calendar_event_update',
    'Googleカレンダーイベントの時間を更新します',
    {
      eventId: z.string().describe('イベントID'),
      start: z.string().describe('新しい開始日時（ISO8601）'),
      end: z.string().describe('新しい終了日時（ISO8601）'),
    },
    async (params) => handleCalendarEventUpdate(params, await getCtx()),
  );

  server.tool(
    'calendar_event_delete',
    'Googleカレンダーのイベントを削除します',
    { eventId: z.string().describe('イベントID') },
    async (params) => handleCalendarEventDelete(params, await getCtx()),
  );

  server.tool(
    'schedule_block_list',
    '登録済みスケジュールブロックを取得します',
    { taskIds: z.string().describe('タスクIDのカンマ区切り') },
    async (params) => handleScheduleBlockList(params, await getCtx()),
  );

  server.tool(
    'schedule_block_create',
    'タスクをGoogleカレンダーに作業ブロックとして登録します',
    {
      taskId: z.string().describe('タスクID'),
      date: z.string().describe('日付（YYYY-MM-DD）'),
      start: z.string().describe('開始時刻（HH:MM）'),
      end: z.string().describe('終了時刻（HH:MM）'),
    },
    async (params) => handleScheduleBlockCreate(params, await getCtx()),
  );

  server.tool(
    'schedule_block_delete',
    'スケジュールブロックを削除します',
    { scheduleBlockId: z.string().describe('ブロックID') },
    async (params) => handleScheduleBlockDelete(params, await getCtx()),
  );

  server.tool(
    'schedule_suggest',
    'AIがタスクの最適なスケジュールを提案します',
    {
      projectId: z.string().optional().describe('プロジェクトID（省略時は全プロジェクト）'),
      myTasksOnly: z.boolean().optional().describe('自分のタスクのみ'),
      workStart: z.number().optional().describe('勤務開始時間（デフォルト9）'),
      workEnd: z.number().optional().describe('勤務終了時間（デフォルト18）'),
      skipWeekends: z.boolean().optional().describe('土日をスキップ（デフォルトtrue）'),
    },
    async (params) => handleScheduleSuggest(params, await getCtx()),
  );
}
