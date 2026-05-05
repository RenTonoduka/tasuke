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
        sectionId: { type: 'string' },
        position: { type: 'number' },
      },
      required: ['taskId'],
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
  // Workspace
  {
    name: 'workspace_list',
    description: 'ワークスペース一覧を取得します',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'workspace_create',
    description: 'ワークスペースを作成します',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'ワークスペース名' } },
      required: ['name'],
    },
    readOnly: false,
  },
  {
    name: 'workspace_update',
    description: 'ワークスペース名を更新します',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['workspaceId', 'name'],
    },
    readOnly: false,
  },
  {
    name: 'workspace_delete',
    description: 'ワークスペースを削除します（オーナーのみ）',
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string' } },
      required: ['workspaceId'],
    },
    readOnly: false,
  },
  {
    name: 'workspace_stats',
    description: 'ワークスペースのタスク統計を取得します',
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string', description: 'ワークスペースID（省略時はデフォルト）' } },
    },
    readOnly: true,
  },
  // Member
  {
    name: 'member_list',
    description: 'ワークスペースのメンバー一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string', description: 'ワークスペースID（省略時はデフォルト）' } },
    },
    readOnly: true,
  },
  {
    name: 'member_invite',
    description: 'メールアドレスでメンバーを招待します',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: '招待するメールアドレス' },
        role: { type: 'string', enum: ['ADMIN', 'MEMBER', 'VIEWER'], description: 'ロール（デフォルトMEMBER）' },
      },
      required: ['email'],
    },
    readOnly: false,
  },
  {
    name: 'member_remove',
    description: 'メンバーを削除します',
    inputSchema: {
      type: 'object',
      properties: { memberId: { type: 'string' } },
      required: ['memberId'],
    },
    readOnly: false,
  },
  // Calendar
  {
    name: 'calendar_event_list',
    description: 'Googleカレンダーのイベント一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: '取得開始日時（ISO8601）' },
        timeMax: { type: 'string', description: '取得終了日時（ISO8601）' },
      },
      required: ['timeMin', 'timeMax'],
    },
    readOnly: true,
  },
  {
    name: 'calendar_event_create',
    description: 'Googleカレンダーにイベントを作成します',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'イベントタイトル' },
        start: { type: 'string', description: '開始日時（ISO8601）' },
        end: { type: 'string', description: '終了日時（ISO8601）' },
      },
      required: ['start', 'end'],
    },
    readOnly: false,
  },
  {
    name: 'calendar_event_update',
    description: 'Googleカレンダーイベントの時間を更新します',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string' },
        start: { type: 'string', description: '新しい開始日時（ISO8601）' },
        end: { type: 'string', description: '新しい終了日時（ISO8601）' },
      },
      required: ['eventId', 'start', 'end'],
    },
    readOnly: false,
  },
  {
    name: 'calendar_event_delete',
    description: 'Googleカレンダーのイベントを削除します',
    inputSchema: {
      type: 'object',
      properties: { eventId: { type: 'string' } },
      required: ['eventId'],
    },
    readOnly: false,
  },
  {
    name: 'schedule_block_list',
    description: '登録済みスケジュールブロックを取得します',
    inputSchema: {
      type: 'object',
      properties: { taskIds: { type: 'string', description: 'タスクIDのカンマ区切り' } },
      required: ['taskIds'],
    },
    readOnly: true,
  },
  {
    name: 'schedule_block_create',
    description: 'タスクをGoogleカレンダーに作業ブロックとして登録します',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        date: { type: 'string', description: '日付（YYYY-MM-DD）' },
        start: { type: 'string', description: '開始時刻（HH:MM）' },
        end: { type: 'string', description: '終了時刻（HH:MM）' },
      },
      required: ['taskId', 'date', 'start', 'end'],
    },
    readOnly: false,
  },
  {
    name: 'schedule_block_delete',
    description: 'スケジュールブロックを削除します',
    inputSchema: {
      type: 'object',
      properties: { scheduleBlockId: { type: 'string' } },
      required: ['scheduleBlockId'],
    },
    readOnly: false,
  },
  {
    name: 'schedule_suggest',
    description: 'AIがタスクの最適なスケジュールを提案します',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'プロジェクトID（省略時は全プロジェクト）' },
        myTasksOnly: { type: 'boolean', description: '自分のタスクのみ' },
        workStart: { type: 'number', description: '勤務開始時間（デフォルト9）' },
        workEnd: { type: 'number', description: '勤務終了時間（デフォルト18）' },
        skipWeekends: { type: 'boolean', description: '土日をスキップ（デフォルトtrue）' },
      },
    },
    readOnly: true,
  },
  // Attachment
  {
    name: 'attachment_list',
    description: 'タスクの添付ファイル一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
    readOnly: true,
  },
  {
    name: 'attachment_add',
    description: 'タスクにGoogle Driveファイルを添付します',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        driveFileId: { type: 'string', description: 'Google DriveファイルID' },
        fileName: { type: 'string', description: 'ファイル名' },
        mimeType: { type: 'string', description: 'MIMEタイプ' },
        url: { type: 'string', description: 'ファイルURL' },
      },
      required: ['taskId', 'driveFileId'],
    },
    readOnly: false,
  },
  {
    name: 'attachment_delete',
    description: '添付ファイルを削除します',
    inputSchema: {
      type: 'object',
      properties: { attachmentId: { type: 'string' } },
      required: ['attachmentId'],
    },
    readOnly: false,
  },
  // Automation
  {
    name: 'automation_list',
    description: 'プロジェクトの自動化ルール一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
    readOnly: true,
  },
  {
    name: 'automation_create',
    description: '自動化ルールを作成します',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string', description: 'ルール名' },
        trigger: { type: 'object', description: 'トリガー条件（JSON）' },
        action: { type: 'object', description: 'アクション（JSON）' },
      },
      required: ['projectId', 'name', 'trigger', 'action'],
    },
    readOnly: false,
  },
  {
    name: 'automation_update',
    description: '自動化ルールを更新します',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string' },
        name: { type: 'string' },
        enabled: { type: 'boolean' },
        trigger: { type: 'object', description: 'トリガー条件（JSON）' },
        action: { type: 'object', description: 'アクション（JSON）' },
      },
      required: ['ruleId'],
    },
    readOnly: false,
  },
  {
    name: 'automation_delete',
    description: '自動化ルールを削除します',
    inputSchema: {
      type: 'object',
      properties: { ruleId: { type: 'string' } },
      required: ['ruleId'],
    },
    readOnly: false,
  },
  // Template
  {
    name: 'template_list',
    description: 'プロジェクトテンプレート一覧を取得します',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'template_create',
    description: 'プロジェクトテンプレートを作成します',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'テンプレート名' },
        description: { type: 'string' },
        color: { type: 'string', description: '色（#RRGGBB）' },
        taskTemplates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
              section: { type: 'string' },
              position: { type: 'number' },
            },
            required: ['title'],
          },
        },
      },
      required: ['name'],
    },
    readOnly: false,
  },
  {
    name: 'template_delete',
    description: 'プロジェクトテンプレートを削除します',
    inputSchema: {
      type: 'object',
      properties: { templateId: { type: 'string' } },
      required: ['templateId'],
    },
    readOnly: false,
  },
  {
    name: 'project_from_template',
    description: 'テンプレートからプロジェクトを作成します',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string' },
        name: { type: 'string', description: 'プロジェクト名' },
      },
      required: ['templateId', 'name'],
    },
    readOnly: false,
  },
  // GitHub
  {
    name: 'github_status',
    description: 'GitHub連携の状態を確認します',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'github_repos',
    description: 'GitHubリポジトリ一覧を取得します',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'github_issues',
    description: 'GitHubリポジトリのIssue一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'リポジトリオーナー' },
        repo: { type: 'string', description: 'リポジトリ名' },
      },
      required: ['owner', 'repo'],
    },
    readOnly: true,
  },
  {
    name: 'github_mapping_list',
    description: 'GitHubリポジトリとプロジェクトのマッピング一覧',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'github_mapping_set',
    description: 'GitHubリポジトリとプロジェクトのマッピングを設定します',
    inputSchema: {
      type: 'object',
      properties: {
        githubRepoFullName: { type: 'string', description: 'リポジトリのフルネーム（owner/repo）' },
        projectId: { type: 'string' },
      },
      required: ['githubRepoFullName', 'projectId'],
    },
    readOnly: false,
  },
  {
    name: 'github_sync',
    description: 'GitHubリポジトリの全Issueを一括同期します',
    inputSchema: {
      type: 'object',
      properties: {
        githubRepoFullName: { type: 'string', description: 'リポジトリのフルネーム（owner/repo）' },
        projectId: { type: 'string', description: '同期先プロジェクトID' },
      },
      required: ['githubRepoFullName', 'projectId'],
    },
    readOnly: false,
  },
  {
    name: 'github_import',
    description: '選択したGitHub Issueをタスクとしてインポートします',
    inputSchema: {
      type: 'object',
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              githubIssueId: { type: 'number' },
              githubIssueNodeId: { type: 'string' },
              githubRepoFullName: { type: 'string' },
              title: { type: 'string' },
              body: { type: 'string' },
              checklistItems: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, checked: { type: 'boolean' } } } },
            },
            required: ['githubIssueId', 'githubIssueNodeId', 'githubRepoFullName', 'title'],
          },
        },
        projectId: { type: 'string' },
        sectionId: { type: 'string' },
        importSubtasks: { type: 'boolean', description: 'チェックリストをサブタスクとしてインポート（デフォルトtrue）' },
      },
      required: ['issues', 'projectId'],
    },
    readOnly: false,
  },
  // Google Tasks
  {
    name: 'gtasks_lists',
    description: 'Google Tasksのリスト一覧を取得します',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'gtasks_tasks',
    description: 'Google Tasksのタスク一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: { listId: { type: 'string', description: 'タスクリストID' } },
      required: ['listId'],
    },
    readOnly: true,
  },
  {
    name: 'gtasks_mapping_set',
    description: 'Google TasksリストとプロジェクトのマッピングID設定',
    inputSchema: {
      type: 'object',
      properties: {
        googleTaskListId: { type: 'string', description: 'Google TasksリストID' },
        googleTaskListName: { type: 'string', description: 'リスト名' },
        projectId: { type: 'string' },
      },
      required: ['googleTaskListId', 'googleTaskListName', 'projectId'],
    },
    readOnly: false,
  },
  {
    name: 'gtasks_import',
    description: 'Google Tasksのタスクをインポートします',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              googleTaskId: { type: 'string' },
              googleTaskListId: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              dueDate: { type: 'string' },
            },
            required: ['googleTaskId', 'googleTaskListId', 'title'],
          },
        },
        projectId: { type: 'string' },
        sectionId: { type: 'string' },
      },
      required: ['tasks', 'projectId'],
    },
    readOnly: false,
  },
  // Settings
  {
    name: 'api_token_list',
    description: 'APIトークン一覧を取得します',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'api_token_create',
    description: 'APIトークンを発行します（トークンは1回のみ表示）',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'トークン名' },
        scope: { type: 'string', enum: ['read_only', 'read_write'], description: 'スコープ（デフォルトread_write）' },
        expiresInDays: { type: 'number', description: '有効期限（日数）' },
      },
      required: ['name'],
    },
    readOnly: false,
  },
  {
    name: 'api_token_revoke',
    description: 'APIトークンを無効化します',
    inputSchema: {
      type: 'object',
      properties: { tokenId: { type: 'string' } },
      required: ['tokenId'],
    },
    readOnly: false,
  },
  {
    name: 'project_settings_update',
    description: 'プロジェクトの公開/非公開設定を変更します',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        isPrivate: { type: 'boolean' },
      },
      required: ['projectId', 'isPrivate'],
    },
    readOnly: false,
  },
  {
    name: 'project_reorder',
    description: 'プロジェクトの表示順を変更します',
    inputSchema: {
      type: 'object',
      properties: {
        projectIds: { type: 'array', items: { type: 'string' }, description: 'プロジェクトIDの配列（表示順）' },
      },
      required: ['projectIds'],
    },
    readOnly: false,
  },
  {
    name: 'project_member_list',
    description: 'プロジェクトのメンバー一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
    readOnly: true,
  },
  // ── Meeting ──
  {
    name: 'meeting_list',
    description: '議事録一覧を取得します',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['EXTRACTING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FAILED'] },
        limit: { type: 'number' },
      },
    },
    readOnly: true,
  },
  {
    name: 'meeting_get',
    description: '議事録の詳細＋抽出タスクを取得',
    inputSchema: {
      type: 'object',
      properties: { meetingId: { type: 'string' } },
      required: ['meetingId'],
    },
    readOnly: true,
  },
  {
    name: 'extracted_task_update',
    description: '抽出タスクのfinal*編集（承認前）',
    inputSchema: {
      type: 'object',
      properties: {
        extractedTaskId: { type: 'string' },
        finalTitle: { type: 'string' },
        finalDescription: { type: ['string', 'null'] },
        finalAssigneeId: { type: ['string', 'null'] },
        finalProjectId: { type: ['string', 'null'] },
        finalSectionId: { type: ['string', 'null'] },
        finalDueDate: { type: ['string', 'null'] },
        finalPriority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
      },
      required: ['extractedTaskId'],
    },
    readOnly: false,
  },
  {
    name: 'meeting_approve',
    description: '抽出タスクを一括承認/却下し本番Taskを作成',
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              extractedTaskId: { type: 'string' },
              action: { type: 'string', enum: ['approve', 'reject'] },
            },
            required: ['extractedTaskId', 'action'],
          },
        },
      },
      required: ['meetingId', 'items'],
    },
    readOnly: false,
  },
  {
    name: 'meeting_extract',
    description: '議事録テキストからAIでタスク抽出（PENDING_REVIEWのMeeting作成）',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        transcript: { type: 'string' },
        meetingDate: { type: 'string' },
        attendees: { type: 'array', items: { type: 'object' } },
      },
      required: ['title', 'transcript'],
    },
    readOnly: false,
  },
  {
    name: 'meeting_extract_from_drive',
    description: 'Google Drive Doc(fileId)を取得してタスク抽出',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string' },
        titleOverride: { type: 'string' },
      },
      required: ['fileId'],
    },
    readOnly: false,
  },
  {
    name: 'meeting_re_extract',
    description: '既存Meetingを保存済みtranscriptで再抽出',
    inputSchema: {
      type: 'object',
      properties: { meetingId: { type: 'string' } },
      required: ['meetingId'],
    },
    readOnly: false,
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
  workspace_list: handlers.handleWorkspaceList,
  workspace_create: handlers.handleWorkspaceCreate,
  workspace_update: handlers.handleWorkspaceUpdate,
  workspace_delete: handlers.handleWorkspaceDelete,
  workspace_stats: handlers.handleWorkspaceStats,
  member_list: handlers.handleMemberList,
  member_invite: handlers.handleMemberInvite,
  member_remove: handlers.handleMemberRemove,
  calendar_event_list: handlers.handleCalendarEventList,
  calendar_event_create: handlers.handleCalendarEventCreate,
  calendar_event_update: handlers.handleCalendarEventUpdate,
  calendar_event_delete: handlers.handleCalendarEventDelete,
  schedule_block_list: handlers.handleScheduleBlockList,
  schedule_block_create: handlers.handleScheduleBlockCreate,
  schedule_block_delete: handlers.handleScheduleBlockDelete,
  schedule_suggest: handlers.handleScheduleSuggest,
  attachment_list: handlers.handleAttachmentList,
  attachment_add: handlers.handleAttachmentAdd,
  attachment_delete: handlers.handleAttachmentDelete,
  automation_list: handlers.handleAutomationList,
  automation_create: handlers.handleAutomationCreate,
  automation_update: handlers.handleAutomationUpdate,
  automation_delete: handlers.handleAutomationDelete,
  template_list: handlers.handleTemplateList,
  template_create: handlers.handleTemplateCreate,
  template_delete: handlers.handleTemplateDelete,
  project_from_template: handlers.handleProjectFromTemplate,
  github_status: handlers.handleGitHubStatus,
  github_repos: handlers.handleGitHubRepos,
  github_issues: handlers.handleGitHubIssues,
  github_mapping_list: handlers.handleGitHubMappingList,
  github_mapping_set: handlers.handleGitHubMappingSet,
  github_sync: handlers.handleGitHubSync,
  github_import: handlers.handleGitHubImport,
  gtasks_lists: handlers.handleGTasksLists,
  gtasks_tasks: handlers.handleGTasksTasks,
  gtasks_mapping_set: handlers.handleGTasksMappingSet,
  gtasks_import: handlers.handleGTasksImport,
  api_token_list: handlers.handleApiTokenList,
  api_token_create: handlers.handleApiTokenCreate,
  api_token_revoke: handlers.handleApiTokenRevoke,
  project_settings_update: handlers.handleProjectSettingsUpdate,
  project_reorder: handlers.handleProjectReorder,
  project_member_list: handlers.handleProjectMemberList,
  meeting_list: handlers.handleMeetingList,
  meeting_get: handlers.handleMeetingGet,
  extracted_task_update: handlers.handleExtractedTaskUpdate,
  meeting_approve: handlers.handleMeetingApprove,
  meeting_extract: handlers.handleMeetingExtract,
  meeting_extract_from_drive: handlers.handleMeetingExtractFromDrive,
  meeting_re_extract: handlers.handleMeetingReExtract,
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
