import prisma from '@/lib/prisma';
import { replyMessage } from './client';
import { buildDashboardText } from './flex-messages';
import * as handlers from '@/mcp/tool-handlers';
import type { ToolContext } from '@/mcp/tool-handlers';
import { checkRateLimit } from './rate-limit';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

interface LineMessageInput {
  replyToken: string;
  lineUserId: string;
  text: string;
}

async function resolveContext(lineUserId: string): Promise<ToolContext | null> {
  const mapping = await prisma.lineUserMapping.findUnique({
    where: { lineUserId },
  });
  if (!mapping) return null;
  return { userId: mapping.userId, workspaceId: mapping.workspaceId };
}

function parseResult(result: handlers.ToolResult): unknown {
  try {
    return JSON.parse(result.content[0].text);
  } catch {
    return result.content[0].text;
  }
}

function getJSTToday(): { todayStart: Date; todayEnd: Date } {
  const nowUTC = Date.now();
  const jstMs = nowUTC + JST_OFFSET_MS;
  const jstDate = new Date(jstMs);
  const y = jstDate.getUTCFullYear();
  const m = jstDate.getUTCMonth();
  const d = jstDate.getUTCDate();
  const todayStart = new Date(Date.UTC(y, m, d) - JST_OFFSET_MS);
  const todayEnd = new Date(Date.UTC(y, m, d + 1) - JST_OFFSET_MS);
  return { todayStart, todayEnd };
}

function getAppUrl(): string {
  return process.env.NEXTAUTH_URL || 'https://tasuke.app';
}

export async function handleLineMessage(input: LineMessageInput) {
  const { replyToken, lineUserId, text } = input;
  const trimmed = text.trim();

  const ctx = await resolveContext(lineUserId);
  if (!ctx) {
    // リンキングコードで連携を試行
    if (/^[A-Z0-9]{6}$/.test(trimmed)) {
      const mapping = await prisma.lineUserMapping.findUnique({
        where: { linkingCode: trimmed },
      });
      if (mapping) {
        await prisma.lineUserMapping.update({
          where: { id: mapping.id },
          data: { lineUserId, linkingCode: null },
        });
        await replyMessage(replyToken, [{
          type: 'text',
          text: 'アカウント連携が完了しました！\n「ヘルプ」と送信してコマンド一覧を確認できます。',
        }]);
        return;
      }
    }
    await replyMessage(replyToken, [{
      type: 'text',
      text: `アカウントが連携されていません。\nWebアプリでLINE接続後、表示されるリンクコードを送信してください。\n${getAppUrl()}`,
    }]);
    return;
  }

  if (trimmed === 'ヘルプ' || trimmed === 'help') {
    await replyHelp(replyToken);
  } else if (trimmed === 'ダッシュボード' || trimmed === 'db') {
    await cmdDashboard(replyToken, ctx);
  } else if (trimmed === 'マイタスク' || trimmed === 'my') {
    await cmdMyTasks(replyToken, ctx);
  } else if (trimmed.startsWith('追加 ') || trimmed.startsWith('タスク追加 ')) {
    await cmdQuickAdd(replyToken, trimmed, ctx);
  } else if (trimmed.startsWith('完了 ')) {
    await cmdComplete(replyToken, trimmed, ctx);
  } else if (trimmed === '今日' || trimmed === 'today') {
    await cmdToday(replyToken, ctx);
  } else if (trimmed === '期限切れ' || trimmed === 'overdue') {
    await cmdOverdue(replyToken, ctx);
  } else if (trimmed.startsWith('検索 ') || trimmed.startsWith('search ')) {
    await cmdSearch(replyToken, trimmed, ctx);
  } else {
    await handleAIFallback(replyToken, trimmed, lineUserId, ctx);
  }
}

async function replyHelp(replyToken: string) {
  await replyMessage(replyToken, [{
    type: 'text',
    text: [
      'タス助 LINE ボット',
      '',
      'コマンド一覧:',
      '・ダッシュボード / db',
      '  → 期限切れ・今日・今週のタスク',
      '・マイタスク / my',
      '  → 自分に割り当てられたタスク',
      '・追加 <タスク名>',
      '  → クイックタスク追加',
      '・完了 <タスク名>',
      '  → タスクを完了にする',
      '・今日 / today',
      '  → 今日期限のタスク',
      '・期限切れ / overdue',
      '  → 期限切れタスク',
      '・検索 <キーワード>',
      '  → タスク検索',
    ].join('\n'),
  }]);
}

async function cmdDashboard(replyToken: string, ctx: ToolContext) {
  const result = await handlers.handleDashboard({}, ctx);
  if (result.isError) {
    await replyMessage(replyToken, [{ type: 'text', text: 'ダッシュボードの取得に失敗しました。' }]);
    return;
  }
  const data = parseResult(result) as Record<string, unknown[]>;
  await replyMessage(replyToken, [{ type: 'text', text: buildDashboardText(data) }]);
}

async function cmdMyTasks(replyToken: string, ctx: ToolContext) {
  const result = await handlers.handleMyTasks({ limit: 10 }, ctx);
  if (result.isError) {
    await replyMessage(replyToken, [{ type: 'text', text: '取得に失敗しました。' }]);
    return;
  }
  const tasks = parseResult(result) as TaskData[];
  if (tasks.length === 0) {
    await replyMessage(replyToken, [{ type: 'text', text: '割り当てられたタスクはありません。' }]);
    return;
  }
  const lines = ['【マイタスク】', ...tasks.map(formatTask)];
  await replyMessage(replyToken, [{ type: 'text', text: lines.join('\n') }]);
}

async function cmdQuickAdd(replyToken: string, text: string, ctx: ToolContext) {
  const title = text.replace(/^(追加|タスク追加)\s+/, '').trim();
  if (!title) {
    await replyMessage(replyToken, [{ type: 'text', text: '使い方: 追加 タスク名' }]);
    return;
  }

  const projects = await prisma.project.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { position: 'asc' },
    take: 1,
    select: { id: true, name: true },
  });
  if (projects.length === 0) {
    await replyMessage(replyToken, [{ type: 'text', text: 'プロジェクトがありません。Webアプリから作成してください。' }]);
    return;
  }

  const result = await handlers.handleTaskCreate({ title, projectId: projects[0].id }, ctx);
  if (result.isError) {
    await replyMessage(replyToken, [{ type: 'text', text: 'タスク作成に失敗しました。' }]);
    return;
  }
  await replyMessage(replyToken, [{
    type: 'text',
    text: `タスクを作成しました\n「${title}」\nプロジェクト: ${projects[0].name}`,
  }]);
}

async function cmdComplete(replyToken: string, text: string, ctx: ToolContext) {
  const query = text.replace(/^完了\s+/, '').trim();
  const result = await handlers.handleTaskSearch({ query, limit: 1 }, ctx);
  if (result.isError) {
    await replyMessage(replyToken, [{ type: 'text', text: 'タスクが見つかりません。' }]);
    return;
  }
  const tasks = parseResult(result) as TaskData[];
  if (tasks.length === 0) {
    await replyMessage(replyToken, [{ type: 'text', text: `「${query}」に一致するタスクが見つかりません。` }]);
    return;
  }
  const updateResult = await handlers.handleTaskUpdate({ taskId: tasks[0].id, status: 'DONE' }, ctx);
  if (updateResult.isError) {
    await replyMessage(replyToken, [{ type: 'text', text: 'タスクの完了処理に失敗しました。' }]);
    return;
  }
  await replyMessage(replyToken, [{
    type: 'text',
    text: `タスクを完了にしました\n「${tasks[0].title}」`,
  }]);
}

async function cmdToday(replyToken: string, ctx: ToolContext) {
  const { todayEnd } = getJSTToday();
  const result = await handlers.handleTaskList({ dueBefore: todayEnd.toISOString(), status: 'TODO', limit: 10 }, ctx);
  if (result.isError) {
    await replyMessage(replyToken, [{ type: 'text', text: '取得に失敗しました。' }]);
    return;
  }
  const tasks = parseResult(result) as TaskData[];
  if (tasks.length === 0) {
    await replyMessage(replyToken, [{ type: 'text', text: '今日期限のタスクはありません。' }]);
    return;
  }
  const lines = ['【今日期限】', ...tasks.map(formatTask)];
  await replyMessage(replyToken, [{ type: 'text', text: lines.join('\n') }]);
}

async function cmdOverdue(replyToken: string, ctx: ToolContext) {
  const { todayStart } = getJSTToday();
  const result = await handlers.handleTaskList({ dueBefore: todayStart.toISOString(), status: 'TODO', limit: 10 }, ctx);
  if (result.isError) {
    await replyMessage(replyToken, [{ type: 'text', text: '取得に失敗しました。' }]);
    return;
  }
  const tasks = parseResult(result) as TaskData[];
  if (tasks.length === 0) {
    await replyMessage(replyToken, [{ type: 'text', text: '期限切れタスクはありません。' }]);
    return;
  }
  const lines = ['【期限切れ】', ...tasks.map(formatTask)];
  await replyMessage(replyToken, [{ type: 'text', text: lines.join('\n') }]);
}

async function cmdSearch(replyToken: string, text: string, ctx: ToolContext) {
  const query = text.replace(/^(検索|search)\s+/, '').trim();
  if (!query) {
    await replyMessage(replyToken, [{ type: 'text', text: '使い方: 検索 キーワード' }]);
    return;
  }
  const result = await handlers.handleTaskSearch({ query, limit: 5 }, ctx);
  if (result.isError) {
    await replyMessage(replyToken, [{ type: 'text', text: '検索に失敗しました。' }]);
    return;
  }
  const tasks = parseResult(result) as TaskData[];
  if (tasks.length === 0) {
    await replyMessage(replyToken, [{ type: 'text', text: `「${query}」に一致するタスクが見つかりません。` }]);
    return;
  }
  const lines = [`【検索結果: ${query}】`, ...tasks.map(formatTask)];
  await replyMessage(replyToken, [{ type: 'text', text: lines.join('\n') }]);
}

// ── ヘルパー ──

interface TaskData {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
}

function formatTask(t: TaskData): string {
  const parts = [`・${t.title}`];
  if (t.priority && t.priority !== 'P3') parts.push(`[${t.priority}]`);
  if (t.dueDate) {
    const d = new Date(t.dueDate);
    parts.push(`(${d.getMonth() + 1}/${d.getDate()})`);
  }
  return parts.join(' ');
}

// ── AI フォールバック ──

async function handleAIFallback(
  replyToken: string,
  text: string,
  lineUserId: string,
  ctx: ToolContext,
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: 'コマンドが認識できませんでした。\n「ヘルプ」で使い方を確認できます。',
    }]);
    return;
  }

  const allowed = await checkRateLimit(lineUserId);
  if (!allowed) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: '本日のAIアシスタント利用上限(50回)に達しました。\n固定コマンド(ヘルプ参照)は引き続きご利用いただけます。',
    }]);
    return;
  }

  try {
    const { handleAIMessage } = await import('./ai-handler');
    const reply = await handleAIMessage(text, lineUserId, ctx);
    await replyMessage(replyToken, [{ type: 'text', text: reply }]);
  } catch (error) {
    console.error('[line-ai] error:', error);
    await replyMessage(replyToken, [{
      type: 'text',
      text: 'AIアシスタントで一時的なエラーが発生しました。\n固定コマンドをお試しください。「ヘルプ」で一覧を確認できます。',
    }]);
  }
}
