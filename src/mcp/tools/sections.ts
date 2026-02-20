import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../context.js';
import { ok, err } from '../helpers.js';

export function registerSectionTools(server: McpServer) {

  server.tool(
    'section_list',
    'プロジェクトのセクション一覧を取得します',
    {
      projectId: z.string().describe('プロジェクトID'),
    },
    async ({ projectId }) => {
      try {
        const sections = await prisma.section.findMany({
          where: { projectId },
          include: { _count: { select: { tasks: true } } },
          orderBy: { position: 'asc' },
        });
        return ok(sections);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'section_create',
    'セクションを作成します',
    {
      projectId: z.string().describe('プロジェクトID'),
      name: z.string().describe('セクション名'),
    },
    async (params) => {
      try {
        const maxPos = await prisma.section.aggregate({
          where: { projectId: params.projectId },
          _max: { position: true },
        });

        const section = await prisma.section.create({
          data: {
            name: params.name,
            projectId: params.projectId,
            position: (maxPos._max.position ?? 0) + 1,
          },
        });
        return ok(section);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'section_update',
    'セクション名を更新します',
    {
      sectionId: z.string().describe('セクションID'),
      name: z.string().describe('新しいセクション名'),
    },
    async ({ sectionId, name }) => {
      try {
        const section = await prisma.section.update({
          where: { id: sectionId },
          data: { name },
        });
        return ok(section);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );
}
