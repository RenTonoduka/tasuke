import { NextRequest, NextResponse } from 'next/server';
import { validateApiToken } from '@/lib/api-token';
import type { ToolContext } from '@/mcp/tool-handlers';
import * as handlers from '@/mcp/tool-handlers';

// ツール定義
interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
}

const TOOLS: ToolDef[] = [
  // Task
  {
    name: 'task_list',
    description: 'タスク一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'プロジェクトID' },
        sectionId: { type: 'string', description: 'セクションID' },
        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] },
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
        dueBefore: { type: 'string', description: '期限上限（ISO8601）' },
        dueAfter: { type: 'string', description: '期限下限（ISO8601）' },
        limit: { type: 'number', description: '取得件数' },
      },
    },
    readOnly: true,
  },
  {
    name: 'task_create',
    description: 'タスクを作成します',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        projectId: { type: 'string' },
        sectionId: { type: 'string' },
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
        dueDate: { type: 'string' },
        description: { type: 'string' },
        estimatedHours: { type: 'number' },
      },
      required: ['title', 'projectId'],
    },
    readOnly: false,
  },
  {
    name: 'task_update',
    description: 'タスクを更新します',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] },
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
        startDate: { type: ['string', 'null'] },
        dueDate: { type: ['string', 'null'] },
        estimatedHours: { type: ['number', 'null'] },
        description: { type: ['string', 'null'] },
        sectionId: { type: ['string', 'null'] },
      },
      required: ['taskId'],
    },
    readOnly: false,
  },
  {
    name: 'task_delete',
    description: 'タスクを削除します',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
    readOnly: false,
  },
  {
    name: 'task_move',
    description: 'タスクを別のセクションに移動します',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        sectionId: { type: ['string', 'null'] },
        position: { type: 'number' },
      },
      required: ['taskId', 'sectionId'],
    },
    readOnly: false,
  },
  {
    name: 'task_search',
    description: 'タスクをキーワード検索します',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    readOnly: true,
  },
  // Project
  {
    name: 'project_list',
    description: 'プロジェクト一覧を取得します',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'project_create',
    description: 'プロジェクトを作成します',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        color: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['name'],
    },
    readOnly: false,
  },
  {
    name: 'project_update',
    description: 'プロジェクトを更新します',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string' },
        color: { type: 'string' },
        description: { type: ['string', 'null'] },
      },
      required: ['projectId'],
    },
    readOnly: false,
  },
  {
    name: 'project_delete',
    description: 'プロジェクトを削除します',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
    readOnly: false,
  },
  // Section
  {
    name: 'section_list',
    description: 'セクション一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
    readOnly: true,
  },
  {
    name: 'section_create',
    description: 'セクションを作成します',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['projectId', 'name'],
    },
    readOnly: false,
  },
  {
    name: 'section_update',
    description: 'セクション名を更新します',
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['sectionId', 'name'],
    },
    readOnly: false,
  },
  // Subtask
  {
    name: 'subtask_list',
    description: 'サブタスク一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
    readOnly: true,
  },
  {
    name: 'subtask_create',
    description: 'サブタスクを作成します',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: { type: 'string' },
        title: { type: 'string' },
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
        dueDate: { type: 'string' },
      },
      required: ['parentId', 'title'],
    },
    readOnly: false,
  },
  {
    name: 'subtask_toggle',
    description: 'サブタスクの完了/未完了を切り替えます',
    inputSchema: {
      type: 'object',
      properties: { subtaskId: { type: 'string' } },
      required: ['subtaskId'],
    },
    readOnly: false,
  },
  // Label
  {
    name: 'label_list',
    description: 'ラベル一覧を取得します',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'label_create',
    description: 'ラベルを作成します',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        color: { type: 'string' },
      },
      required: ['name'],
    },
    readOnly: false,
  },
  {
    name: 'task_label_set',
    description: 'タスクのラベルを設定します',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        labelIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['taskId', 'labelIds'],
    },
    readOnly: false,
  },
  // Task Bulk
  {
    name: 'task_bulk_update',
    description: 'タスクを一括操作します（ステータス変更/優先度変更/一括削除）',
    inputSchema: {
      type: 'object',
      properties: {
        taskIds: { type: 'array', items: { type: 'string' }, description: '対象タスクIDの配列' },
        action: { type: 'string', enum: ['status', 'priority', 'delete'], description: '操作種別' },
        value: { type: 'string', description: '設定値' },
      },
      required: ['taskIds', 'action'],
    },
    readOnly: false,
  },
  // Assignee
  {
    name: 'task_assignee_set',
    description: 'タスクの担当者を設定します（既存の担当者は置換）',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        userIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['taskId', 'userIds'],
    },
    readOnly: false,
  },
  // Activity
  {
    name: 'activity_list',
    description: 'タスクのアクティビティ履歴を取得します',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['taskId'],
    },
    readOnly: true,
  },
  // Comment
  {
    name: 'comment_list',
    description: 'コメント一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['taskId'],
    },
    readOnly: true,
  },
  {
    name: 'comment_add',
    description: 'コメントを追加します',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['taskId', 'content'],
    },
    readOnly: false,
  },
  {
    name: 'comment_update',
    description: 'コメントを編集します（自分のコメントのみ）',
    inputSchema: {
      type: 'object',
      properties: {
        commentId: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['commentId', 'content'],
    },
    readOnly: false,
  },
  {
    name: 'comment_delete',
    description: 'コメントを削除します（自分のコメントのみ）',
    inputSchema: {
      type: 'object',
      properties: { commentId: { type: 'string' } },
      required: ['commentId'],
    },
    readOnly: false,
  },
  // Section Delete
  {
    name: 'section_delete',
    description: 'セクションを削除します',
    inputSchema: {
      type: 'object',
      properties: { sectionId: { type: 'string' } },
      required: ['sectionId'],
    },
    readOnly: false,
  },
  // Notification
  {
    name: 'notification_list',
    description: '通知一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: {
        unreadOnly: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
    readOnly: true,
  },
  {
    name: 'notification_read',
    description: '通知を既読にします',
    inputSchema: {
      type: 'object',
      properties: { notificationId: { type: 'string' } },
      required: ['notificationId'],
    },
    readOnly: false,
  },
  {
    name: 'notification_read_all',
    description: '全ての未読通知を既読にします',
    inputSchema: { type: 'object', properties: {} },
    readOnly: false,
  },
  // Dashboard
  {
    name: 'dashboard',
    description: '期限切れ・今日期限・今週期限・進行中タスクを一括取得します',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'my_tasks',
    description: '自分にアサインされたタスク一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] },
        limit: { type: 'number' },
      },
    },
    readOnly: true,
  },
];

// ツール名 → ハンドラーのマッピング
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOL_HANDLERS: Record<string, (params: any, ctx: ToolContext) => Promise<handlers.ToolResult>> = {
  task_list: handlers.handleTaskList,
  task_create: handlers.handleTaskCreate,
  task_update: handlers.handleTaskUpdate,
  task_delete: handlers.handleTaskDelete,
  task_move: handlers.handleTaskMove,
  task_search: handlers.handleTaskSearch,
  project_list: handlers.handleProjectList,
  project_create: handlers.handleProjectCreate,
  project_update: handlers.handleProjectUpdate,
  project_delete: handlers.handleProjectDelete,
  section_list: handlers.handleSectionList,
  section_create: handlers.handleSectionCreate,
  section_update: handlers.handleSectionUpdate,
  subtask_list: handlers.handleSubtaskList,
  subtask_create: handlers.handleSubtaskCreate,
  subtask_toggle: handlers.handleSubtaskToggle,
  label_list: handlers.handleLabelList,
  label_create: handlers.handleLabelCreate,
  task_label_set: handlers.handleTaskLabelSet,
  comment_list: handlers.handleCommentList,
  comment_add: handlers.handleCommentAdd,
  comment_update: handlers.handleCommentUpdate,
  comment_delete: handlers.handleCommentDelete,
  section_delete: handlers.handleSectionDelete,
  task_bulk_update: handlers.handleTaskBulkUpdate,
  task_assignee_set: handlers.handleTaskAssigneeSet,
  activity_list: handlers.handleActivityList,
  notification_list: handlers.handleNotificationList,
  notification_read: handlers.handleNotificationRead,
  notification_read_all: handlers.handleNotificationReadAll,
  dashboard: handlers.handleDashboard,
  my_tasks: handlers.handleMyTasks,
};

// JSON-RPC レスポンスヘルパー
function jsonrpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result });
}

function jsonrpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } });
}

export async function POST(req: NextRequest) {
  // Bearer トークン認証
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonrpcError(null, -32000, 'Authorization: Bearer <token> が必要です');
  }

  const tokenCtx = await validateApiToken(authHeader.slice(7));
  if (!tokenCtx) {
    return jsonrpcError(null, -32000, '無効なAPIトークンです');
  }

  // JSON-RPC リクエストパース
  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonrpcError(null, -32700, 'JSONパースエラー');
  }

  const { id, method, params } = body;

  // MCP initialize
  if (method === 'initialize') {
    return jsonrpcResult(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'tasuke', version: '1.0.0' },
    });
  }

  // MCP tools/list
  if (method === 'tools/list') {
    const tools = TOOLS
      .filter((t) => tokenCtx.scope !== 'read_only' || t.readOnly)
      .map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
    return jsonrpcResult(id, { tools });
  }

  // MCP tools/call
  if (method === 'tools/call') {
    const toolName = (params?.name as string) ?? '';
    const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};

    const toolDef = TOOLS.find((t) => t.name === toolName);
    if (!toolDef) {
      return jsonrpcError(id, -32601, `不明なツール: ${toolName}`);
    }

    // read_only スコープで書き込みツールを拒否
    if (tokenCtx.scope === 'read_only' && !toolDef.readOnly) {
      return jsonrpcError(id, -32000, 'read_onlyトークンでは書き込み操作はできません');
    }

    const handler = TOOL_HANDLERS[toolName];
    if (!handler) {
      return jsonrpcError(id, -32601, `ハンドラー未実装: ${toolName}`);
    }

    const ctx: ToolContext = {
      userId: tokenCtx.userId,
      workspaceId: tokenCtx.workspaceId,
    };

    const result = await handler(toolArgs, ctx);
    return jsonrpcResult(id, result);
  }

  // notifications/initialized (MCP仕様 - 応答不要だがエラーにしない)
  if (method === 'notifications/initialized') {
    return new NextResponse(null, { status: 204 });
  }

  return jsonrpcError(id, -32601, `不明なメソッド: ${method}`);
}
