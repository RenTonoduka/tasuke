#!/usr/bin/env node
/**
 * タス助 CLI - MCP 76ツールを軽量CLIとして提供
 *
 * CLIHub方式: 全スキーマを事前ロードせず、--help で遅延取得
 * → AIエージェントのトークンコスト94%削減
 *
 * 環境変数:
 *   TASUKE_API_TOKEN  - APIトークン（必須）
 *   TASUKE_URL        - ベースURL（デフォルト: https://tasuke.app）
 */

const BASE_URL = process.env.TASUKE_URL || 'https://tasuke.app';
const API_TOKEN = process.env.TASUKE_API_TOKEN || '';

// ── コマンド定義（軽量: 名前 + 1行説明のみ） ──

interface CmdDef {
  name: string;
  desc: string;
  usage: string;
  example: string;
}

const COMMANDS: CmdDef[] = [
  // Task
  { name: 'task:list',     desc: 'タスク一覧を取得', usage: '[--projectId ID] [--status TODO|IN_PROGRESS|DONE] [--priority P0-P3] [--limit N]', example: 'tasuke task:list --projectId abc --status TODO' },
  { name: 'task:create',   desc: 'タスクを作成', usage: '--title TEXT --projectId ID [--priority P0-P3] [--dueDate ISO] [--description TEXT]', example: 'tasuke task:create --title "新機能" --projectId abc' },
  { name: 'task:update',   desc: 'タスクを更新', usage: '--taskId ID [--title TEXT] [--status TODO|IN_PROGRESS|DONE] [--priority P0-P3]', example: 'tasuke task:update --taskId abc --status DONE' },
  { name: 'task:delete',   desc: 'タスクを削除', usage: '--taskId ID', example: 'tasuke task:delete --taskId abc' },
  { name: 'task:move',     desc: 'タスクをセクション移動', usage: '--taskId ID --sectionId ID|null [--position N]', example: 'tasuke task:move --taskId abc --sectionId def' },
  { name: 'task:search',   desc: 'タスクを検索', usage: '--query TEXT [--limit N]', example: 'tasuke task:search --query "バグ修正"' },
  { name: 'task:bulk',     desc: 'タスク一括操作', usage: '--taskIds ID1,ID2 --action status|priority|delete [--value TEXT]', example: 'tasuke task:bulk --taskIds id1,id2 --action status --value DONE' },
  { name: 'task:assignee', desc: 'タスク担当者設定', usage: '--taskId ID --userIds ID1,ID2', example: 'tasuke task:assignee --taskId abc --userIds user1,user2' },
  { name: 'task:activity', desc: 'タスクのアクティビティ履歴', usage: '--taskId ID [--limit N]', example: 'tasuke task:activity --taskId abc' },
  // Project
  { name: 'project:list',    desc: 'プロジェクト一覧', usage: '(引数なし)', example: 'tasuke project:list' },
  { name: 'project:create',  desc: 'プロジェクト作成', usage: '--name TEXT [--color HEX] [--description TEXT]', example: 'tasuke project:create --name "開発"' },
  { name: 'project:update',  desc: 'プロジェクト更新', usage: '--projectId ID [--name TEXT] [--color HEX]', example: 'tasuke project:update --projectId abc --name "新名前"' },
  { name: 'project:delete',  desc: 'プロジェクト削除', usage: '--projectId ID', example: 'tasuke project:delete --projectId abc' },
  { name: 'project:settings', desc: 'プロジェクト公開/非公開設定', usage: '--projectId ID --isPrivate true|false', example: 'tasuke project:settings --projectId abc --isPrivate true' },
  { name: 'project:reorder', desc: 'プロジェクト表示順変更', usage: '--projectIds ID1,ID2,ID3', example: 'tasuke project:reorder --projectIds id1,id2,id3' },
  { name: 'project:members', desc: 'プロジェクトメンバー一覧', usage: '--projectId ID', example: 'tasuke project:members --projectId abc' },
  // Section
  { name: 'section:list',   desc: 'セクション一覧', usage: '--projectId ID', example: 'tasuke section:list --projectId abc' },
  { name: 'section:create', desc: 'セクション作成', usage: '--projectId ID --name TEXT', example: 'tasuke section:create --projectId abc --name "レビュー"' },
  { name: 'section:update', desc: 'セクション名更新', usage: '--sectionId ID --name TEXT', example: 'tasuke section:update --sectionId abc --name "新名前"' },
  { name: 'section:delete', desc: 'セクション削除', usage: '--sectionId ID', example: 'tasuke section:delete --sectionId abc' },
  // Subtask
  { name: 'subtask:list',   desc: 'サブタスク一覧', usage: '--taskId ID', example: 'tasuke subtask:list --taskId abc' },
  { name: 'subtask:create', desc: 'サブタスク作成', usage: '--parentId ID --title TEXT [--priority P0-P3]', example: 'tasuke subtask:create --parentId abc --title "子タスク"' },
  { name: 'subtask:toggle', desc: 'サブタスク完了切替', usage: '--subtaskId ID', example: 'tasuke subtask:toggle --subtaskId abc' },
  // Label
  { name: 'label:list',   desc: 'ラベル一覧', usage: '(引数なし)', example: 'tasuke label:list' },
  { name: 'label:create', desc: 'ラベル作成', usage: '--name TEXT [--color HEX]', example: 'tasuke label:create --name "urgent" --color "#EA4335"' },
  { name: 'label:set',    desc: 'タスクにラベル設定', usage: '--taskId ID --labelIds ID1,ID2', example: 'tasuke label:set --taskId abc --labelIds id1,id2' },
  // Comment
  { name: 'comment:list',   desc: 'コメント一覧', usage: '--taskId ID [--limit N]', example: 'tasuke comment:list --taskId abc' },
  { name: 'comment:add',    desc: 'コメント追加', usage: '--taskId ID --content TEXT', example: 'tasuke comment:add --taskId abc --content "対応完了"' },
  { name: 'comment:update', desc: 'コメント編集', usage: '--commentId ID --content TEXT', example: 'tasuke comment:update --commentId abc --content "修正"' },
  { name: 'comment:delete', desc: 'コメント削除', usage: '--commentId ID', example: 'tasuke comment:delete --commentId abc' },
  // Notification
  { name: 'notification:list',    desc: '通知一覧', usage: '[--unreadOnly true] [--limit N]', example: 'tasuke notification:list --unreadOnly true' },
  { name: 'notification:read',    desc: '通知を既読に', usage: '--notificationId ID', example: 'tasuke notification:read --notificationId abc' },
  { name: 'notification:readall', desc: '全通知を既読に', usage: '(引数なし)', example: 'tasuke notification:readall' },
  // Dashboard
  { name: 'dashboard', desc: '期限切れ/今日/今週/進行中タスク一括取得', usage: '(引数なし)', example: 'tasuke dashboard' },
  { name: 'my:tasks',  desc: '自分のタスク一覧', usage: '[--status TODO|IN_PROGRESS|DONE] [--limit N]', example: 'tasuke my:tasks --status IN_PROGRESS' },
  // Workspace
  { name: 'workspace:list',   desc: 'ワークスペース一覧', usage: '(引数なし)', example: 'tasuke workspace:list' },
  { name: 'workspace:create', desc: 'ワークスペース作成', usage: '--name TEXT', example: 'tasuke workspace:create --name "チーム開発"' },
  { name: 'workspace:update', desc: 'ワークスペース名更新', usage: '--workspaceId ID --name TEXT', example: 'tasuke workspace:update --workspaceId abc --name "新名前"' },
  { name: 'workspace:delete', desc: 'ワークスペース削除', usage: '--workspaceId ID', example: 'tasuke workspace:delete --workspaceId abc' },
  { name: 'workspace:stats',  desc: 'ワークスペース統計', usage: '[--workspaceId ID]', example: 'tasuke workspace:stats' },
  // Member
  { name: 'member:list',   desc: 'メンバー一覧', usage: '[--workspaceId ID]', example: 'tasuke member:list' },
  { name: 'member:invite', desc: 'メンバー招待', usage: '--email TEXT [--role ADMIN|MEMBER|VIEWER]', example: 'tasuke member:invite --email user@example.com' },
  { name: 'member:remove', desc: 'メンバー削除', usage: '--memberId ID', example: 'tasuke member:remove --memberId abc' },
  // Calendar
  { name: 'calendar:list',   desc: 'カレンダーイベント取得', usage: '--timeMin ISO --timeMax ISO', example: 'tasuke calendar:list --timeMin 2025-01-01T00:00:00Z --timeMax 2025-01-31T23:59:59Z' },
  { name: 'calendar:create', desc: 'カレンダーイベント作成', usage: '--start ISO --end ISO [--summary TEXT]', example: 'tasuke calendar:create --start 2025-01-15T10:00:00Z --end 2025-01-15T11:00:00Z --summary "会議"' },
  { name: 'calendar:update', desc: 'カレンダーイベント更新', usage: '--eventId ID --start ISO --end ISO', example: 'tasuke calendar:update --eventId abc --start 2025-01-15T14:00:00Z --end 2025-01-15T15:00:00Z' },
  { name: 'calendar:delete', desc: 'カレンダーイベント削除', usage: '--eventId ID', example: 'tasuke calendar:delete --eventId abc' },
  // Schedule
  { name: 'schedule:blocks',  desc: 'スケジュールブロック取得', usage: '--taskIds ID1,ID2', example: 'tasuke schedule:blocks --taskIds id1,id2' },
  { name: 'schedule:create',  desc: '作業ブロック登録', usage: '--taskId ID --date YYYY-MM-DD --start HH:MM --end HH:MM', example: 'tasuke schedule:create --taskId abc --date 2025-01-15 --start 10:00 --end 12:00' },
  { name: 'schedule:delete',  desc: 'スケジュールブロック削除', usage: '--scheduleBlockId ID', example: 'tasuke schedule:delete --scheduleBlockId abc' },
  { name: 'schedule:suggest', desc: 'AIスケジュール提案', usage: '[--projectId ID] [--workStart N] [--workEnd N]', example: 'tasuke schedule:suggest --projectId abc' },
  // Attachment
  { name: 'attachment:list',   desc: '添付ファイル一覧', usage: '--taskId ID', example: 'tasuke attachment:list --taskId abc' },
  { name: 'attachment:add',    desc: 'Google Driveファイル添付', usage: '--taskId ID --driveFileId ID [--fileName TEXT]', example: 'tasuke attachment:add --taskId abc --driveFileId fileId' },
  { name: 'attachment:delete', desc: '添付ファイル削除', usage: '--attachmentId ID', example: 'tasuke attachment:delete --attachmentId abc' },
  // Automation
  { name: 'automation:list',   desc: '自動化ルール一覧', usage: '--projectId ID', example: 'tasuke automation:list --projectId abc' },
  { name: 'automation:create', desc: '自動化ルール作成', usage: '--projectId ID --name TEXT --json \'{"trigger":{...},"action":{...}}\'', example: 'tasuke automation:create --projectId abc --name "自動完了" --json \'{"trigger":{},"action":{}}\''},
  { name: 'automation:update', desc: '自動化ルール更新', usage: '--ruleId ID [--name TEXT] [--enabled true|false]', example: 'tasuke automation:update --ruleId abc --enabled false' },
  { name: 'automation:delete', desc: '自動化ルール削除', usage: '--ruleId ID', example: 'tasuke automation:delete --ruleId abc' },
  // Template
  { name: 'template:list',   desc: 'テンプレート一覧', usage: '(引数なし)', example: 'tasuke template:list' },
  { name: 'template:create', desc: 'テンプレート作成', usage: '--name TEXT [--description TEXT] [--color HEX]', example: 'tasuke template:create --name "スプリント"' },
  { name: 'template:delete', desc: 'テンプレート削除', usage: '--templateId ID', example: 'tasuke template:delete --templateId abc' },
  { name: 'template:apply',  desc: 'テンプレートからプロジェクト作成', usage: '--templateId ID --name TEXT', example: 'tasuke template:apply --templateId abc --name "Sprint 1"' },
  // GitHub
  { name: 'github:status',   desc: 'GitHub連携状態確認', usage: '(引数なし)', example: 'tasuke github:status' },
  { name: 'github:repos',    desc: 'GitHubリポジトリ一覧', usage: '(引数なし)', example: 'tasuke github:repos' },
  { name: 'github:issues',   desc: 'GitHub Issue一覧', usage: '--owner TEXT --repo TEXT', example: 'tasuke github:issues --owner myorg --repo myrepo' },
  { name: 'github:mappings', desc: 'リポジトリマッピング一覧', usage: '(引数なし)', example: 'tasuke github:mappings' },
  { name: 'github:map',      desc: 'リポジトリマッピング設定', usage: '--githubRepoFullName owner/repo --projectId ID', example: 'tasuke github:map --githubRepoFullName myorg/myrepo --projectId abc' },
  { name: 'github:sync',     desc: '全Issue一括同期', usage: '--githubRepoFullName owner/repo --projectId ID', example: 'tasuke github:sync --githubRepoFullName myorg/myrepo --projectId abc' },
  { name: 'github:import',   desc: 'GitHub Issueインポート', usage: '--json \'{"issues":[...],"projectId":"ID"}\'', example: 'tasuke github:import --json \'{"issues":[{"githubIssueId":1,"githubIssueNodeId":"N1","githubRepoFullName":"o/r","title":"t"}],"projectId":"abc"}\'' },
  // Google Tasks
  { name: 'gtasks:lists',  desc: 'Google Tasksリスト一覧', usage: '(引数なし)', example: 'tasuke gtasks:lists' },
  { name: 'gtasks:tasks',  desc: 'Google Tasksタスク一覧', usage: '--listId ID', example: 'tasuke gtasks:tasks --listId abc' },
  { name: 'gtasks:map',    desc: 'Google Tasksマッピング設定', usage: '--googleTaskListId ID --googleTaskListName TEXT --projectId ID', example: 'tasuke gtasks:map --googleTaskListId abc --googleTaskListName "My Tasks" --projectId def' },
  { name: 'gtasks:import', desc: 'Google Tasksインポート', usage: '--json \'{"tasks":[...],"projectId":"ID"}\'', example: 'tasuke gtasks:import --json \'{"tasks":[{"googleTaskId":"g1","googleTaskListId":"l1","title":"t"}],"projectId":"abc"}\'' },
  // API Token
  { name: 'token:list',   desc: 'APIトークン一覧', usage: '(引数なし)', example: 'tasuke token:list' },
  { name: 'token:create', desc: 'APIトークン発行', usage: '--name TEXT [--scope read_only|read_write] [--expiresInDays N]', example: 'tasuke token:create --name "CI" --scope read_write' },
  { name: 'token:revoke', desc: 'APIトークン無効化', usage: '--tokenId ID', example: 'tasuke token:revoke --tokenId abc' },
];

// CLI名 → MCP名 マッピング
const CLI_TO_MCP: Record<string, string> = {
  // Task
  'task:list': 'task_list',
  'task:create': 'task_create',
  'task:update': 'task_update',
  'task:delete': 'task_delete',
  'task:move': 'task_move',
  'task:search': 'task_search',
  'task:bulk': 'task_bulk_update',
  'task:assignee': 'task_assignee_set',
  'task:activity': 'activity_list',
  // Project
  'project:list': 'project_list',
  'project:create': 'project_create',
  'project:update': 'project_update',
  'project:delete': 'project_delete',
  'project:settings': 'project_settings_update',
  'project:reorder': 'project_reorder',
  'project:members': 'project_member_list',
  // Section
  'section:list': 'section_list',
  'section:create': 'section_create',
  'section:update': 'section_update',
  'section:delete': 'section_delete',
  // Subtask
  'subtask:list': 'subtask_list',
  'subtask:create': 'subtask_create',
  'subtask:toggle': 'subtask_toggle',
  // Label
  'label:list': 'label_list',
  'label:create': 'label_create',
  'label:set': 'task_label_set',
  // Comment
  'comment:list': 'comment_list',
  'comment:add': 'comment_add',
  'comment:update': 'comment_update',
  'comment:delete': 'comment_delete',
  // Notification
  'notification:list': 'notification_list',
  'notification:read': 'notification_read',
  'notification:readall': 'notification_read_all',
  // Dashboard
  'dashboard': 'dashboard',
  'my:tasks': 'my_tasks',
  // Workspace
  'workspace:list': 'workspace_list',
  'workspace:create': 'workspace_create',
  'workspace:update': 'workspace_update',
  'workspace:delete': 'workspace_delete',
  'workspace:stats': 'workspace_stats',
  // Member
  'member:list': 'member_list',
  'member:invite': 'member_invite',
  'member:remove': 'member_remove',
  // Calendar
  'calendar:list': 'calendar_event_list',
  'calendar:create': 'calendar_event_create',
  'calendar:update': 'calendar_event_update',
  'calendar:delete': 'calendar_event_delete',
  // Schedule
  'schedule:blocks': 'schedule_block_list',
  'schedule:create': 'schedule_block_create',
  'schedule:delete': 'schedule_block_delete',
  'schedule:suggest': 'schedule_suggest',
  // Attachment
  'attachment:list': 'attachment_list',
  'attachment:add': 'attachment_add',
  'attachment:delete': 'attachment_delete',
  // Automation
  'automation:list': 'automation_list',
  'automation:create': 'automation_create',
  'automation:update': 'automation_update',
  'automation:delete': 'automation_delete',
  // Template
  'template:list': 'template_list',
  'template:create': 'template_create',
  'template:delete': 'template_delete',
  'template:apply': 'project_from_template',
  // GitHub
  'github:status': 'github_status',
  'github:repos': 'github_repos',
  'github:issues': 'github_issues',
  'github:mappings': 'github_mapping_list',
  'github:map': 'github_mapping_set',
  'github:sync': 'github_sync',
  'github:import': 'github_import',
  // Google Tasks
  'gtasks:lists': 'gtasks_lists',
  'gtasks:tasks': 'gtasks_tasks',
  'gtasks:map': 'gtasks_mapping_set',
  'gtasks:import': 'gtasks_import',
  // API Token
  'token:list': 'api_token_list',
  'token:create': 'api_token_create',
  'token:revoke': 'api_token_revoke',
};

// ── 引数パーサー ──

function parseArgs(argv: string[]): { command: string; flags: Record<string, string>; help: boolean; json: string | null } {
  const command = argv[0] || '';
  const flags: Record<string, string> = {};
  let help = false;
  let json: string | null = null;

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--json') {
      json = argv[++i] || '{}';
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = argv[++i] || '';
      flags[key] = val;
    }
  }

  return { command, flags, help, json };
}

// flags → MCP arguments 変換
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

// ── MCP呼び出し ──

async function callMcp(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  if (!API_TOKEN) {
    console.error('Error: TASUKE_API_TOKEN 環境変数を設定してください');
    console.error('  設定 > APIトークン からトークンを発行できます');
    process.exit(1);
  }

  const res = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });

  if (!res.ok) {
    console.error(`HTTP Error: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const data = await res.json() as {
    result?: { content?: { text: string }[]; isError?: boolean };
    error?: { message: string };
  };

  if (data.error) {
    console.error(`Error: ${data.error.message}`);
    process.exit(1);
  }

  const text = data.result?.content?.[0]?.text;
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ── メイン ──

async function main() {
  const argv = process.argv.slice(2);

  // 引数なし or --help → コマンド一覧（軽量リスト）
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log('タス助 CLI v0.3.0\n');
    console.log('Usage: tasuke <command> [options]\n');
    console.log('Commands:');
    const maxLen = Math.max(...COMMANDS.map((c) => c.name.length));
    for (const cmd of COMMANDS) {
      console.log(`  ${cmd.name.padEnd(maxLen + 2)}${cmd.desc}`);
    }
    console.log('\nOptions:');
    console.log('  --help, -h     コマンドの詳細を表示');
    console.log('  --json JSON    引数をJSONで直接渡す');
    console.log('\nEnvironment:');
    console.log('  TASUKE_API_TOKEN  APIトークン（必須）');
    console.log(`  TASUKE_URL        ベースURL（デフォルト: ${BASE_URL}）`);
    return;
  }

  const { command, flags, help, json } = parseArgs(argv);
  const cmdDef = COMMANDS.find((c) => c.name === command);

  if (!cmdDef) {
    console.error(`Unknown command: ${command}`);
    console.error('Run "tasuke --help" for available commands');
    process.exit(1);
  }

  // --help → コマンド詳細（遅延ロード相当）
  if (help) {
    console.log(`${cmdDef.name} - ${cmdDef.desc}\n`);
    console.log(`Usage: tasuke ${cmdDef.name} ${cmdDef.usage}\n`);
    console.log(`Example: ${cmdDef.example}`);
    return;
  }

  const mcpName = CLI_TO_MCP[command];
  if (!mcpName) {
    console.error(`No MCP mapping for: ${command}`);
    process.exit(1);
  }

  const args = json ? JSON.parse(json) : flagsToArgs(flags);
  const result = await callMcp(mcpName, args);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
