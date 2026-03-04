import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleAttachmentList,
  handleAttachmentAdd,
  handleAttachmentDelete,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerAttachmentTools(server: McpServer) {
  server.tool(
    'attachment_list',
    'タスクの添付ファイル一覧を取得します',
    { taskId: z.string().describe('タスクID') },
    async (params) => handleAttachmentList(params, await getCtx()),
  );

  server.tool(
    'attachment_add',
    'タスクにGoogle Driveファイルを添付します',
    {
      taskId: z.string().describe('タスクID'),
      driveFileId: z.string().describe('Google DriveファイルID'),
      fileName: z.string().optional().describe('ファイル名'),
      mimeType: z.string().optional().describe('MIMEタイプ'),
      url: z.string().optional().describe('ファイルURL'),
    },
    async (params) => handleAttachmentAdd(params, await getCtx()),
  );

  server.tool(
    'attachment_delete',
    '添付ファイルを削除します',
    { attachmentId: z.string().describe('添付ファイルID') },
    async (params) => handleAttachmentDelete(params, await getCtx()),
  );
}
