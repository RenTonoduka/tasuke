import * as handlers from '@/mcp/tool-handlers';
import type { ToolContext, ToolResult } from '@/mcp/tool-handlers';

// LINE向けCLIコマンド定義（25コマンドに絞り込み）
const LINE_COMMANDS = [
  { name: 'task:list', desc: 'タスク一覧', usage: '[--projectId ID] [--status TODO|IN_PROGRESS|DONE] [--priority P0-P3] [--limit N]' },
  { name: 'task:create', desc: 'タスク作成', usage: '--title TEXT --projectId ID [--priority P0-P3] [--dueDate ISO] [--description TEXT]' },
  { name: 'task:update', desc: 'タスク更新', usage: '--taskId ID [--title TEXT] [--status TODO|IN_PROGRESS|DONE] [--priority P0-P3] [--dueDate ISO]' },
  { name: 'task:delete', desc: 'タスク削除', usage: '--taskId ID' },
  { name: 'task:search', desc: 'タスク検索', usage: '--query TEXT [--limit N]' },
  { name: 'task:move', desc: 'タスクをセクション移動', usage: '--taskId ID [--sectionId ID] [--position N]' },
  { name: 'task:assignee', desc: 'タスク担当者設定', usage: '--taskId ID --userIds ID1,ID2' },
  { name: 'project:list', desc: 'プロジェクト一覧', usage: '(引数なし)' },
  { name: 'section:list', desc: 'セクション一覧', usage: '--projectId ID' },
  { name: 'subtask:list', desc: 'サブタスク一覧', usage: '--taskId ID' },
  { name: 'subtask:create', desc: 'サブタスク作成', usage: '--parentId ID --title TEXT' },
  { name: 'subtask:toggle', desc: 'サブタスク完了切替', usage: '--subtaskId ID' },
  { name: 'label:list', desc: 'ラベル一覧', usage: '(引数なし)' },
  { name: 'label:create', desc: 'ラベル作成', usage: '--name TEXT [--color HEX]' },
  { name: 'label:set', desc: 'タスクにラベル設定', usage: '--taskId ID --labelIds ID1,ID2' },
  { name: 'comment:list', desc: 'コメント一覧', usage: '--taskId ID' },
  { name: 'comment:add', desc: 'コメント追加', usage: '--taskId ID --content TEXT' },
  { name: 'dashboard', desc: '期限切れ/今日/今週/進行中タスク', usage: '(引数なし)' },
  { name: 'my:tasks', desc: '自分のタスク一覧', usage: '[--status TODO|IN_PROGRESS|DONE] [--limit N]' },
  { name: 'calendar:list', desc: 'カレンダー予定取得', usage: '--timeMin ISO --timeMax ISO' },
  { name: 'calendar:create', desc: 'カレンダー予定作成', usage: '--start ISO --end ISO [--summary TEXT]' },
  { name: 'calendar:update', desc: 'カレンダー予定更新', usage: '--eventId ID --start ISO --end ISO [--summary TEXT]' },
  { name: 'calendar:delete', desc: 'カレンダー予定削除', usage: '--eventId ID' },
  { name: 'schedule:suggest', desc: 'AIスケジュール提案', usage: '[--projectId ID]' },
  { name: 'notification:list', desc: '通知一覧', usage: '[--unreadOnly true] [--limit N]' },
] as const;

// CLI名 → MCP名マッピング
const CLI_TO_MCP: Record<string, string> = {
  'task:list': 'task_list',
  'task:create': 'task_create',
  'task:update': 'task_update',
  'task:delete': 'task_delete',
  'task:search': 'task_search',
  'task:move': 'task_move',
  'task:assignee': 'task_assignee_set',
  'project:list': 'project_list',
  'section:list': 'section_list',
  'subtask:list': 'subtask_list',
  'subtask:create': 'subtask_create',
  'subtask:toggle': 'subtask_toggle',
  'label:list': 'label_list',
  'label:create': 'label_create',
  'label:set': 'task_label_set',
  'comment:list': 'comment_list',
  'comment:add': 'comment_add',
  'dashboard': 'dashboard',
  'my:tasks': 'my_tasks',
  'calendar:list': 'calendar_event_list',
  'calendar:create': 'calendar_event_create',
  'calendar:update': 'calendar_event_update',
  'calendar:delete': 'calendar_event_delete',
  'schedule:suggest': 'schedule_suggest',
  'notification:list': 'notification_list',
};

// MCP名 → ハンドラー
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HANDLER_MAP: Record<string, (params: any, ctx: ToolContext) => Promise<ToolResult>> = {
  task_list: handlers.handleTaskList,
  task_create: handlers.handleTaskCreate,
  task_update: handlers.handleTaskUpdate,
  task_delete: handlers.handleTaskDelete,
  task_search: handlers.handleTaskSearch,
  task_move: handlers.handleTaskMove,
  task_assignee_set: handlers.handleTaskAssigneeSet,
  project_list: handlers.handleProjectList,
  section_list: handlers.handleSectionList,
  subtask_list: handlers.handleSubtaskList,
  subtask_create: handlers.handleSubtaskCreate,
  subtask_toggle: handlers.handleSubtaskToggle,
  label_list: handlers.handleLabelList,
  label_create: handlers.handleLabelCreate,
  task_label_set: handlers.handleTaskLabelSet,
  comment_list: handlers.handleCommentList,
  comment_add: handlers.handleCommentAdd,
  dashboard: handlers.handleDashboard,
  my_tasks: handlers.handleMyTasks,
  calendar_event_list: handlers.handleCalendarEventList,
  calendar_event_create: handlers.handleCalendarEventCreate,
  calendar_event_update: handlers.handleCalendarEventUpdate,
  calendar_event_delete: handlers.handleCalendarEventDelete,
  schedule_suggest: handlers.handleScheduleSuggest,
  notification_list: handlers.handleNotificationList,
};

/** CLIヘルプテキスト生成（システムプロンプト用） */
export function generateCLIHelp(): string {
  return LINE_COMMANDS.map(c => `${c.name} ${c.usage} — ${c.desc}`).join('\n');
}

/** コマンド文字列をパースして引数に分解 */
function parseArgs(argv: string[]): { command: string; flags: Record<string, string>; json: string | null } {
  const command = argv[0] || '';
  const flags: Record<string, string> = {};
  let json: string | null = null;

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      json = argv[++i] || '{}';
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = argv[++i] || '';
      flags[key] = val;
    }
  }

  return { command, flags, json };
}

/** フラグ値を型推論して変換 */
function flagsToArgs(flags: Record<string, string>): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(flags)) {
    if (val === 'null') {
      args[key] = null;
    } else if (val === 'true') {
      args[key] = true;
    } else if (val === 'false') {
      args[key] = false;
    } else if (/^\d+$/.test(val)) {
      args[key] = parseInt(val, 10);
    } else if (/^\d+\.\d+$/.test(val)) {
      args[key] = parseFloat(val);
    } else if (['labelIds', 'taskIds', 'userIds', 'projectIds'].includes(key)) {
      args[key] = val.split(',');
    } else {
      args[key] = val;
    }
  }
  return args;
}

/** クオートを考慮したコマンド文字列の分割 */
function shellSplit(str: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        result.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) result.push(current);
  return result;
}

/** 長すぎるレスポンスを切り詰め */
function truncateResult(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n...(結果が長いため省略)';
}

/** CLIコマンド文字列を実行 */
export async function executeCLICommand(
  commandString: string,
  ctx: ToolContext,
): Promise<{ success: boolean; result: string }> {
  try {
    const argv = shellSplit(commandString);
    const { command, flags, json } = parseArgs(argv);

    const mcpName = CLI_TO_MCP[command];
    if (!mcpName) {
      const available = Object.keys(CLI_TO_MCP).join(', ');
      return { success: false, result: `不明なコマンド: ${command}。利用可能: ${available}` };
    }

    const handler = HANDLER_MAP[mcpName];
    if (!handler) {
      return { success: false, result: `ハンドラー未実装: ${mcpName}` };
    }

    const args = json ? JSON.parse(json) : flagsToArgs(flags);
    const result = await handler(args, ctx);
    const text = result.content[0].text;

    return {
      success: !result.isError,
      result: truncateResult(text, 3000),
    };
  } catch (error) {
    return {
      success: false,
      result: `コマンド実行エラー: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
