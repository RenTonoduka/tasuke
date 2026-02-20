import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma, getDefaultWorkspace } from '../context.js';
import { ok, err } from '../helpers.js';

export function registerProjectTools(server: McpServer) {

  server.tool(
    'project_list',
    'プロジェクト一覧を取得します',
    {},
    async () => {
      try {
        const workspaceId = await getDefaultWorkspace();
        const projects = await prisma.project.findMany({
          where: { workspaceId },
          include: {
            sections: { orderBy: { position: 'asc' }, select: { id: true, name: true } },
            _count: { select: { tasks: true } },
          },
          orderBy: { position: 'asc' },
        });
        return ok(projects);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'project_create',
    'プロジェクトを作成します（Todo/進行中/完了セクション自動作成）',
    {
      name: z.string().describe('プロジェクト名'),
      color: z.string().optional().describe('色（HEX, デフォルト #4285F4）'),
      description: z.string().optional().describe('説明'),
    },
    async (params) => {
      try {
        const workspaceId = await getDefaultWorkspace();

        const maxPos = await prisma.project.aggregate({
          where: { workspaceId },
          _max: { position: true },
        });

        const project = await prisma.project.create({
          data: {
            name: params.name,
            color: params.color ?? '#4285F4',
            description: params.description ?? null,
            workspaceId,
            position: (maxPos._max.position ?? 0) + 1,
            sections: {
              create: [
                { name: 'Todo', position: 0 },
                { name: '進行中', position: 1 },
                { name: '完了', position: 2 },
              ],
            },
          },
          include: { sections: { orderBy: { position: 'asc' } } },
        });
        return ok(project);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'project_update',
    'プロジェクトを更新します',
    {
      projectId: z.string().describe('プロジェクトID'),
      name: z.string().optional().describe('プロジェクト名'),
      color: z.string().optional().describe('色（HEX）'),
      description: z.string().optional().nullable().describe('説明'),
    },
    async (params) => {
      try {
        const { projectId, ...data } = params;
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.color !== undefined) updateData.color = data.color;
        if (data.description !== undefined) updateData.description = data.description;

        const project = await prisma.project.update({
          where: { id: projectId },
          data: updateData,
        });
        return ok(project);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'project_delete',
    'プロジェクトを削除します（配下のタスク・セクションも全削除）',
    {
      projectId: z.string().describe('プロジェクトID'),
    },
    async ({ projectId }) => {
      try {
        await prisma.project.delete({ where: { id: projectId } });
        return ok({ success: true, deletedId: projectId });
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );
}
