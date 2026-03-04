import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleTemplateList,
  handleTemplateCreate,
  handleTemplateDelete,
  handleProjectFromTemplate,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerTemplateTools(server: McpServer) {
  server.tool(
    'template_list',
    'プロジェクトテンプレート一覧を取得します',
    {},
    async () => handleTemplateList({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'template_create',
    'プロジェクトテンプレートを作成します',
    {
      name: z.string().describe('テンプレート名'),
      description: z.string().optional().describe('説明'),
      color: z.string().optional().describe('色（#RRGGBB、デフォルト#4285F4）'),
      taskTemplates: z.array(z.object({
        title: z.string().describe('タスク名'),
        description: z.string().optional().describe('説明'),
        priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('優先度（デフォルトP3）'),
        section: z.string().optional().describe('セクション名（デフォルトTodo）'),
        position: z.number().optional().describe('表示順'),
      })).optional().describe('タスクテンプレートの配列'),
    },
    async (params) => handleTemplateCreate(params, await getCtx()),
  );

  server.tool(
    'template_delete',
    'プロジェクトテンプレートを削除します',
    { templateId: z.string().describe('テンプレートID') },
    async (params) => handleTemplateDelete(params, await getCtx()),
  );

  server.tool(
    'project_from_template',
    'テンプレートからプロジェクトを作成します',
    {
      templateId: z.string().describe('テンプレートID'),
      name: z.string().describe('プロジェクト名'),
    },
    async (params) => handleProjectFromTemplate(params, await getCtx()),
  );
}
