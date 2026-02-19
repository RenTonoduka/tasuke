import prisma from './prisma';
import { createNotification } from './notifications';

interface AutomationContext {
  taskId: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  userId: string;
}

interface TriggerDef {
  type: string;
  from?: string;
  to?: string;
  daysBefore?: number;
}

interface ActionDef {
  type: string;
  message?: string;
  priority?: string;
  sectionName?: string;
  labelName?: string;
}

function matchesTrigger(trigger: TriggerDef, triggerType: string, ctx: AutomationContext): boolean {
  if (trigger.type !== triggerType) return false;

  if (triggerType === 'STATUS_CHANGE') {
    if (trigger.to && ctx.newValue !== trigger.to) return false;
    if (trigger.from && ctx.oldValue !== trigger.from) return false;
    return true;
  }

  if (triggerType === 'PRIORITY_CHANGE') {
    if (trigger.to && ctx.newValue !== trigger.to) return false;
    return true;
  }

  if (triggerType === 'DUE_DATE_APPROACHING') {
    return true;
  }

  return false;
}

async function executeAction(action: ActionDef, taskId: string, projectId: string): Promise<void> {
  if (action.type === 'NOTIFY_ASSIGNEES') {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (!task) return;

    const msg = action.message ?? `タスク「${task.title}」が更新されました`;
    await Promise.all(
      task.assignees.map((a) =>
        createNotification({ userId: a.userId, type: 'AUTOMATION', message: msg, taskId })
      )
    );
  }

  if (action.type === 'SET_PRIORITY') {
    if (!action.priority) return;
    await prisma.task.update({
      where: { id: taskId },
      data: { priority: action.priority as 'P0' | 'P1' | 'P2' | 'P3' },
    });
  }

  if (action.type === 'MOVE_SECTION') {
    if (!action.sectionName) return;
    const section = await prisma.section.findFirst({
      where: { projectId, name: action.sectionName },
    });
    // 修正3: セクションが見つからない場合はwarnログ
    if (!section) {
      console.warn(`[automation] MOVE_SECTION: セクション「${action.sectionName}」が見つかりません (projectId: ${projectId})`);
      return;
    }
    await prisma.task.update({
      where: { id: taskId },
      data: { sectionId: section.id },
    });
  }

  if (action.type === 'ADD_LABEL') {
    if (!action.labelName) return;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { workspaceId: true } } },
    });
    if (!task) return;

    // 修正3: ラベル数上限チェック（100件以上なら作成をスキップ）
    const labelCount = await prisma.label.count({
      where: { workspaceId: task.project.workspaceId },
    });
    if (labelCount >= 100) {
      console.warn(`[automation] ADD_LABEL: ラベル数上限(100)に達しています (workspaceId: ${task.project.workspaceId})`);
      return;
    }

    let label = await prisma.label.findFirst({
      where: { workspaceId: task.project.workspaceId, name: action.labelName },
    });
    if (!label) {
      label = await prisma.label.create({
        data: { name: action.labelName, workspaceId: task.project.workspaceId },
      });
    }

    await prisma.taskLabel.upsert({
      where: { taskId_labelId: { taskId, labelId: label.id } },
      create: { taskId, labelId: label.id },
      update: {},
    });
  }
}

export async function executeAutomationRules(
  projectId: string,
  triggerType: string,
  ctx: AutomationContext
): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: { projectId, enabled: true },
  });

  for (const rule of rules) {
    try {
      const trigger = rule.trigger as unknown as TriggerDef;
      const action = rule.action as unknown as ActionDef;

      if (!matchesTrigger(trigger, triggerType, ctx)) continue;
      await executeAction(action, ctx.taskId, projectId);
    } catch (err) {
      console.error(`[automation] ルール ${rule.id} 実行エラー:`, err);
    }
  }
}
