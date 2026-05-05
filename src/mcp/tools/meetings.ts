import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleMeetingList,
  handleMeetingGet,
  handleExtractedTaskUpdate,
  handleMeetingApprove,
  handleMeetingExtract,
  handleMeetingExtractFromDrive,
  handleMeetingReExtract,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerMeetingTools(server: McpServer) {
  server.tool(
    'meeting_list',
    '議事録一覧を取得します（PENDING_REVIEW = レビュー待ち）',
    {
      status: z
        .enum(['EXTRACTING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FAILED'])
        .optional()
        .describe('ステータスフィルタ'),
      limit: z.number().optional().describe('取得件数（デフォルト50）'),
    },
    async (params) => handleMeetingList(params, await getCtx()),
  );

  server.tool(
    'meeting_get',
    '議事録の詳細＋抽出タスク一覧を取得します',
    {
      meetingId: z.string().describe('議事録のID'),
    },
    async (params) => handleMeetingGet(params, await getCtx()),
  );

  server.tool(
    'extracted_task_update',
    '抽出タスクのfinal*フィールドを編集（承認前）',
    {
      extractedTaskId: z.string(),
      finalTitle: z.string().optional(),
      finalDescription: z.string().optional().nullable(),
      finalAssigneeId: z.string().optional().nullable().describe('Userのid'),
      finalProjectId: z.string().optional().nullable(),
      finalSectionId: z.string().optional().nullable(),
      finalDueDate: z.string().optional().nullable().describe('YYYY-MM-DD or ISO'),
      finalPriority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
    },
    async (params) => handleExtractedTaskUpdate(params, await getCtx()),
  );

  server.tool(
    'meeting_approve',
    '議事録の抽出タスクを一括承認/却下しTaskを作成',
    {
      meetingId: z.string(),
      items: z
        .array(
          z.object({
            extractedTaskId: z.string(),
            action: z.enum(['approve', 'reject']),
          }),
        )
        .min(1),
    },
    async (params) => handleMeetingApprove(params, await getCtx()),
  );

  server.tool(
    'meeting_extract',
    '議事録テキストからAIでタスクを抽出（PENDING_REVIEWのMeeting作成）',
    {
      title: z.string().describe('会議タイトル'),
      transcript: z.string().min(10).describe('議事録本文（最大15万字）'),
      meetingDate: z.string().optional().describe('YYYY-MM-DD or ISO'),
      attendees: z
        .array(z.object({ name: z.string().optional(), email: z.string().optional() }))
        .optional(),
    },
    async (params) => handleMeetingExtract(params, await getCtx()),
  );

  server.tool(
    'meeting_extract_from_drive',
    'Google Drive上の議事録Doc(fileId)を取得してタスク抽出',
    {
      fileId: z.string().describe('Google Drive file ID'),
      titleOverride: z.string().optional(),
    },
    async (params) => handleMeetingExtractFromDrive(params, await getCtx()),
  );

  server.tool(
    'meeting_re_extract',
    '既存Meetingを保存済みtranscriptで再抽出（パーサー改善後の救済用）',
    { meetingId: z.string() },
    async (params) => handleMeetingReExtract(params, await getCtx()),
  );
}
