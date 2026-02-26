#!/usr/bin/env node
/**
 * タス助 CLI - MCP 24ツールを軽量CLIとして提供
 *
 * CLIHub方式: 全スキーマを事前ロードせず、--help で遅延取得
 * → AIエージェントのトークンコスト94%削減
 *
 * 環境変数:
 *   TASUKE_API_TOKEN  - APIトークン（必須）
 *   TASUKE_URL        - ベースURL（デフォルト: https://tasuke-nu.vercel.app）
 */

const BASE_URL = process.env.TASUKE_URL || 'https://tasuke-nu.vercel.app';
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
  { name: 'task:list',    desc: 'タスク一覧を取得', usage: '[--projectId ID] [--status TODO|IN_PROGRESS|DONE] [--priority P0-P3] [--limit N]', example: 'tasuke task:list --projectId abc --status TODO' },
  { name: 'task:create',  desc: 'タスクを作成', usage: '--title TEXT --projectId ID [--priority P0-P3] [--dueDate ISO] [--description TEXT]', example: 'tasuke task:create --title "新機能" --projectId abc' },
  { name: 'task:update',  desc: 'タスクを更新', usage: '--taskId ID [--title TEXT] [--status TODO|IN_PROGRESS|DONE] [--priority P0-P3]', example: 'tasuke task:update --taskId abc --status DONE' },
  { name: 'task:delete',  desc: 'タスクを削除', usage: '--taskId ID', example: 'tasuke task:delete --taskId abc' },
  { name: 'task:move',    desc: 'タスクをセクション移動', usage: '--taskId ID --sectionId ID|null [--position N]', example: 'tasuke task:move --taskId abc --sectionId def' },
  { name: 'task:search',  desc: 'タスクを検索', usage: '--query TEXT [--limit N]', example: 'tasuke task:search --query "バグ修正"' },
  // Project
  { name: 'project:list',   desc: 'プロジェクト一覧', usage: '(引数なし)', example: 'tasuke project:list' },
  { name: 'project:create', desc: 'プロジェクト作成', usage: '--name TEXT [--color HEX] [--description TEXT]', example: 'tasuke project:create --name "開発"' },
  { name: 'project:update', desc: 'プロジェクト更新', usage: '--projectId ID [--name TEXT] [--color HEX]', example: 'tasuke project:update --projectId abc --name "新名前"' },
  { name: 'project:delete', desc: 'プロジェクト削除', usage: '--projectId ID', example: 'tasuke project:delete --projectId abc' },
  // Section
  { name: 'section:list',   desc: 'セクション一覧', usage: '--projectId ID', example: 'tasuke section:list --projectId abc' },
  { name: 'section:create', desc: 'セクション作成', usage: '--projectId ID --name TEXT', example: 'tasuke section:create --projectId abc --name "レビュー"' },
  { name: 'section:update', desc: 'セクション名更新', usage: '--sectionId ID --name TEXT', example: 'tasuke section:update --sectionId abc --name "新名前"' },
  // Subtask
  { name: 'subtask:list',   desc: 'サブタスク一覧', usage: '--taskId ID', example: 'tasuke subtask:list --taskId abc' },
  { name: 'subtask:create', desc: 'サブタスク作成', usage: '--parentId ID --title TEXT [--priority P0-P3]', example: 'tasuke subtask:create --parentId abc --title "子タスク"' },
  { name: 'subtask:toggle', desc: 'サブタスク完了切替', usage: '--subtaskId ID', example: 'tasuke subtask:toggle --subtaskId abc' },
  // Label
  { name: 'label:list',   desc: 'ラベル一覧', usage: '(引数なし)', example: 'tasuke label:list' },
  { name: 'label:create', desc: 'ラベル作成', usage: '--name TEXT [--color HEX]', example: 'tasuke label:create --name "urgent" --color "#EA4335"' },
  { name: 'label:set',    desc: 'タスクにラベル設定', usage: '--taskId ID --labelIds ID1,ID2', example: 'tasuke label:set --taskId abc --labelIds id1,id2' },
  // Comment
  { name: 'comment:list', desc: 'コメント一覧', usage: '--taskId ID [--limit N]', example: 'tasuke comment:list --taskId abc' },
  { name: 'comment:add',  desc: 'コメント追加', usage: '--taskId ID --content TEXT', example: 'tasuke comment:add --taskId abc --content "対応完了"' },
  // Dashboard
  { name: 'dashboard',  desc: '期限切れ/今日/今週/進行中タスク一括取得', usage: '(引数なし)', example: 'tasuke dashboard' },
  { name: 'my:tasks',   desc: '自分のタスク一覧', usage: '[--status TODO|IN_PROGRESS|DONE] [--limit N]', example: 'tasuke my:tasks --status IN_PROGRESS' },
];

// CLI名 → MCP名 マッピング
const CLI_TO_MCP: Record<string, string> = {
  'task:list': 'task_list',
  'task:create': 'task_create',
  'task:update': 'task_update',
  'task:delete': 'task_delete',
  'task:move': 'task_move',
  'task:search': 'task_search',
  'project:list': 'project_list',
  'project:create': 'project_create',
  'project:update': 'project_update',
  'project:delete': 'project_delete',
  'section:list': 'section_list',
  'section:create': 'section_create',
  'section:update': 'section_update',
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
    } else if (key === 'labelIds') {
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
    console.log('タス助 CLI v0.2.0\n');
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
