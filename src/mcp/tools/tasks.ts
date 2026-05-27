import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleTaskList,
  handleTaskCreate,
  handleTaskUpdate,
  handleTaskDelete,
  handleTaskDuplicate,
  handleTaskMove,
  handleTaskSearch,
  handleTaskBulkUpdate,
  handleTaskAssigneeSet,
  handleActivityList,
  handleTaskRequest,
  handleTaskAccept,
  handleTaskDecline,
  handleTaskSubmit,
  handleTaskApprove,
  handleTaskSendBack,
  handleTaskCancelRequest,
  handleApprovalsList,
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
    'task_duplicate',
    'タスクを複製します（タイトル末尾に「(コピー)」付与、同セクション末尾配置、assignees/labelsもコピー）',
    { taskId: z.string().describe('複製元タスクID') },
    async (params) => handleTaskDuplicate(params, await getCtx()),
  );

  server.tool(
    'task_move',
    'タスクを別のセクションまたはプロジェクトに移動します',
    {
      taskId: z.string().describe('タスクID'),
      sectionId: z.string().nullable().describe('移動先セクションID（nullでセクション未所属）'),
      projectId: z.string().optional().describe('移動先プロジェクトID（省略時は現在のプロジェクト内で移動）'),
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

  server.tool(
    'task_bulk_update',
    'タスクを一括操作します（ステータス変更/優先度変更/一括削除）',
    {
      taskIds: z.array(z.string()).min(1).max(100).describe('対象タスクIDの配列'),
      action: z.enum(['status', 'priority', 'delete']).describe('操作種別'),
      value: z.string().optional().describe('設定値（status: TODO/IN_PROGRESS/DONE, priority: P0-P3）'),
    },
    async (params) => handleTaskBulkUpdate(params, await getCtx()),
  );

  server.tool(
    'task_assignee_set',
    'タスクの担当者を設定します（既存の担当者は置換）',
    {
      taskId: z.string().describe('タスクID'),
      userIds: z.array(z.string()).describe('担当者のユーザーIDの配列（空配列で全解除）'),
    },
    async (params) => handleTaskAssigneeSet(params, await getCtx()),
  );

  server.tool(
    'activity_list',
    'タスクのアクティビティ履歴を取得します',
    {
      taskId: z.string().describe('タスクID'),
      limit: z.number().optional().describe('取得件数（デフォルト30）'),
    },
    async (params) => handleActivityList(params, await getCtx()),
  );

  // ===== 依頼→承認ワークフロー =====
  server.tool(
    'task_request',
    'タスクを担当者に依頼し受諾待ちにします（依頼→承認ワークフロー開始）',
    {
      taskId: z.string().describe('タスクID'),
      assigneeId: z.string().describe('担当者のユーザーID'),
      dueDate: z.string().nullable().optional().describe('期日(ISO文字列)'),
      comment: z.string().optional().describe('依頼コメント'),
    },
    async (params) => handleTaskRequest(params, await getCtx()),
  );
  server.tool(
    'task_accept',
    '依頼を受諾し対応中にします（担当者のみ）',
    { taskId: z.string().describe('タスクID') },
    async (params) => handleTaskAccept(params, await getCtx()),
  );
  server.tool(
    'task_decline',
    '依頼を辞退します（担当者のみ・コメント必須）',
    {
      taskId: z.string().describe('タスクID'),
      comment: z.string().describe('辞退理由（必須）'),
    },
    async (params) => handleTaskDecline(params, await getCtx()),
  );
  server.tool(
    'task_submit',
    '完了報告を出し承認待ちにします（担当者のみ）',
    { taskId: z.string().describe('タスクID') },
    async (params) => handleTaskSubmit(params, await getCtx()),
  );
  server.tool(
    'task_approve',
    '完了報告を承認し完了にします（依頼者のみ）',
    { taskId: z.string().describe('タスクID') },
    async (params) => handleTaskApprove(params, await getCtx()),
  );
  server.tool(
    'task_send_back',
    '完了報告を差し戻します（依頼者のみ・コメント必須）',
    {
      taskId: z.string().describe('タスクID'),
      comment: z.string().describe('差し戻し理由（必須）'),
    },
    async (params) => handleTaskSendBack(params, await getCtx()),
  );
  server.tool(
    'task_cancel_request',
    '依頼を取り消し通常タスクに戻します（依頼者のみ）',
    { taskId: z.string().describe('タスクID') },
    async (params) => handleTaskCancelRequest(params, await getCtx()),
  );
  server.tool(
    'approvals_list',
    '自分の「承認する番(toApprove)」と「受諾/対応する番(toAccept)」を一覧取得します',
    {},
    async (params) => handleApprovalsList(params, await getCtx()),
  );
}
