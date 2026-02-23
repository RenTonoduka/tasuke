import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma, getDefaultWorkspace } from '../context.js';
import { ok, err } from '../helpers.js';

export function registerLabelTools(server: McpServer) {

  server.tool(
    'label_list',
    'ワークスペースのラベル一覧を取得します',
    {},
    async () => {
      try {
        const workspaceId = await getDefaultWorkspace();
        const labels = await prisma.label.findMany({
          where: { workspaceId },
          orderBy: { name: 'asc' },
        });
        return ok(labels);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'label_create',
    'ラベルを作成します',
    {
      name: z.string().describe('ラベル名'),
      color: z.string().optional().describe('色（HEX, デフォルト #4285F4）'),
    },
    async (params) => {
      try {
        const workspaceId = await getDefaultWorkspace();
        const label = await prisma.label.create({
          data: {
            name: params.name,
            color: params.color ?? '#4285F4',
            workspaceId,
          },
        });
        return ok(label);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.tool(
    'task_label_set',
    'タスクのラベルを設定します（既存ラベルは置換）',
    {
      taskId: z.string().describe('タスクID'),
      labelIds: z.array(z.string()).describe('設定するラベルIDの配列（空配列で全解除）'),
    },
    async ({ taskId, labelIds }) => {
      try {
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: { labels: true },
        });
        if (!task) return err('タスクが見つかりません');

        const currentIds = task.labels.map((l) => l.labelId);
        const toAdd = labelIds.filter((id) => !currentIds.includes(id));
        const toRemove = currentIds.filter((id) => !labelIds.includes(id));

        await prisma.$transaction([
          ...toRemove.map((labelId) =>
            prisma.taskLabel.deleteMany({ where: { taskId, labelId } })
          ),
          ...toAdd.map((labelId) =>
            prisma.taskLabel.create({ data: { taskId, labelId } })
          ),
        ]);

        const updated = await prisma.task.findUnique({
          where: { id: taskId },
          include: { labels: { include: { label: true } } },
        });
        return ok(updated?.labels ?? []);
      } catch (e: unknown) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  );
}
