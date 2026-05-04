import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { matchMember } from './member-matcher';
import type { Priority, MeetingSource } from '@prisma/client';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TRANSCRIPT_CHARS = 50_000;
const MAX_OUTPUT_TOKENS = 4096;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

interface ExtractInput {
  workspaceId: string;
  userId: string;
  title: string;
  transcript: string;
  meetingDate?: Date | null;
  attendees?: { name?: string; email?: string }[];
  source?: MeetingSource;
  driveFileId?: string | null;
  driveFileName?: string | null;
  driveWebViewLink?: string | null;
  driveOwnerEmail?: string | null;
}

interface LlmTask {
  originalQuote: string;
  suggestedTitle: string;
  suggestedDescription?: string | null;
  suggestedAssigneeId?: string | null;
  suggestedAssigneeName?: string | null;
  suggestedProjectId?: string | null;
  suggestedProjectCandidates?: { projectId: string; score: number }[];
  suggestedDueDate?: string | null;
  suggestedPriority?: Priority;
  confidence: number;
}

const TOOL_NAME = 'submit_extracted_tasks';

const TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: '議事録から抽出した行動可能なタスク（action item）をまとめて提出する',
  input_schema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            originalQuote: { type: 'string', description: '議事録の該当箇所の引用（最大200字）' },
            suggestedTitle: { type: 'string', description: '動詞始まりの命令形タイトル' },
            suggestedDescription: { type: 'string' },
            suggestedAssigneeId: { type: 'string', description: 'ワークスペースメンバーのid。判断不能なら省略' },
            suggestedAssigneeName: { type: 'string', description: '突合できなかった場合の生テキスト名' },
            suggestedProjectId: { type: 'string' },
            suggestedProjectCandidates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  projectId: { type: 'string' },
                  score: { type: 'number' },
                },
                required: ['projectId', 'score'],
              },
            },
            suggestedDueDate: { type: 'string', description: 'YYYY-MM-DD or ISO datetime' },
            suggestedPriority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['originalQuote', 'suggestedTitle', 'confidence'],
        },
      },
    },
    required: ['tasks'],
  },
};

const SYSTEM_PROMPT = `あなたは日本語ビジネス会議の議事録から「行動可能なタスク（action item）」を抽出する専門アシスタントです。

ルール:
- 「決定事項」「単なる議論」は無視し、誰かが「やる」と決めたタスクのみ抽出
- タスクのタイトルは動詞で始まる命令形（例: "資料Xをレビューする"）
- 複数人に割り当てられた場合は別タスクに分割
- 期日表現があれば日付に変換（"来週金曜" → 具体的な日付。会議日 meetingDate を基準に計算）
- 担当者は議事録に出てくる名前/メールから候補リスト（ワークスペースメンバー）の中で最も近い1名を選ぶ。判断不能なら suggestedAssigneeId は省略し suggestedAssigneeName に生テキスト名を入れる
- プロジェクトは下記候補リストの説明と内容から最も適切なものを選ぶ。confidence < 0.7 なら suggestedProjectId は省略し suggestedProjectCandidates に上位3件を入れる
- 各タスクには originalQuote として、抽出根拠となった議事録の該当行（最大200字）を必ず含める
- confidence は (1) action項目として明確 (2) 担当・期日が明示 (3) 文脈から自明 を総合して0.0-1.0で評価

出力は必ず submit_extracted_tasks ツールを呼び出して構造化して返す。テキスト返答はしない。`;

export interface ExtractResult {
  meetingId: string;
  extractedCount: number;
  failed: boolean;
  failureReason?: string;
}

export async function extractMeeting(input: ExtractInput): Promise<ExtractResult> {
  const transcript = input.transcript.length > MAX_TRANSCRIPT_CHARS
    ? input.transcript.slice(0, MAX_TRANSCRIPT_CHARS)
    : input.transcript;

  // 1) Meeting レコード作成（EXTRACTING状態）
  const meeting = await prisma.meeting.create({
    data: {
      workspaceId: input.workspaceId,
      createdById: input.userId,
      source: input.source ?? 'MANUAL_PASTE',
      status: 'EXTRACTING',
      title: input.title,
      transcript,
      meetingDate: input.meetingDate ?? null,
      attendees: input.attendees ? (input.attendees as object) : undefined,
      driveFileId: input.driveFileId ?? null,
      driveFileName: input.driveFileName ?? null,
      driveWebViewLink: input.driveWebViewLink ?? null,
      driveOwnerEmail: input.driveOwnerEmail ?? null,
    },
  });

  try {
    // 2) 文脈情報取得
    const [projects, members] = await Promise.all([
      prisma.project.findMany({
        where: { workspaceId: input.workspaceId },
        select: { id: true, name: true, description: true },
        orderBy: { position: 'asc' },
      }),
      prisma.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const memberLites = members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    }));
    const memberIdSet = new Set(memberLites.map((m) => m.id));
    const projectIdSet = new Set(projects.map((p) => p.id));

    // 直近のタスクをFew-shot用に
    const recentTasks = await prisma.task.findMany({
      where: { project: { workspaceId: input.workspaceId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { title: true, project: { select: { name: true } } },
    });

    // 3) LLM呼び出し
    const userMessage = buildUserMessage({
      meetingTitle: input.title,
      meetingDate: input.meetingDate ?? null,
      attendees: input.attendees ?? [],
      projects,
      members: memberLites,
      recentTasks,
      transcript,
    });

    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === TOOL_NAME,
    );
    if (!toolUse) {
      throw new Error('LLMがツール呼び出しを返しませんでした');
    }
    const llmTasks = ((toolUse.input as { tasks?: LlmTask[] })?.tasks) ?? [];

    // 4) 後処理: メンバー/プロジェクトIDを再検証 + name fallback マッチ
    const sanitized = llmTasks.map((t) => {
      let assigneeId = t.suggestedAssigneeId && memberIdSet.has(t.suggestedAssigneeId) ? t.suggestedAssigneeId : null;
      const assigneeName = t.suggestedAssigneeName ?? null;
      if (!assigneeId && assigneeName) {
        const matched = matchMember(assigneeName, memberLites);
        if (matched) assigneeId = matched.id;
      }
      const projectId = t.suggestedProjectId && projectIdSet.has(t.suggestedProjectId) ? t.suggestedProjectId : null;
      const candidates = (t.suggestedProjectCandidates ?? [])
        .filter((c) => projectIdSet.has(c.projectId))
        .slice(0, 3);

      const dueDate = parseDate(t.suggestedDueDate);
      const priority = (t.suggestedPriority ?? 'P3') as Priority;
      const confidence = clamp01(t.confidence);

      return {
        originalQuote: (t.originalQuote ?? '').slice(0, 1000),
        confidence,
        suggestedTitle: t.suggestedTitle.slice(0, 200),
        suggestedDescription: t.suggestedDescription ?? null,
        suggestedAssigneeId: assigneeId,
        suggestedAssigneeName: assigneeName,
        suggestedProjectId: confidence >= 0.7 ? projectId : null,
        suggestedProjectCandidates: candidates.length ? candidates : null,
        suggestedDueDate: dueDate,
        suggestedPriority: priority,
      };
    });

    // 5) ExtractedTask一括作成 + Meeting更新
    await prisma.$transaction([
      prisma.extractedTask.createMany({
        data: sanitized.map((s) => ({
          meetingId: meeting.id,
          ...s,
          suggestedProjectCandidates: s.suggestedProjectCandidates ?? undefined,
        })),
      }),
      prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: 'PENDING_REVIEW',
          llmModel: MODEL,
          llmInputTokens: response.usage?.input_tokens ?? null,
          llmOutputTokens: response.usage?.output_tokens ?? null,
        },
      }),
    ]);

    return { meetingId: meeting.id, extractedCount: sanitized.length, failed: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: 'FAILED', failureReason: reason },
    });
    return { meetingId: meeting.id, extractedCount: 0, failed: true, failureReason: reason };
  }
}

function buildUserMessage(args: {
  meetingTitle: string;
  meetingDate: Date | null;
  attendees: { name?: string; email?: string }[];
  projects: { id: string; name: string; description: string | null }[];
  members: { id: string; name: string | null; email: string }[];
  recentTasks: { title: string; project: { name: string } }[];
  transcript: string;
}): string {
  const meetingDateStr = args.meetingDate ? args.meetingDate.toISOString().slice(0, 10) : '不明';
  const attendeesStr = args.attendees.length
    ? args.attendees.map((a) => [a.name, a.email].filter(Boolean).join(' <') + (a.email ? '>' : '')).join(', ')
    : '不明';

  const projectsStr = args.projects
    .map((p) => `- id="${p.id}" name="${p.name}"${p.description ? ` desc="${p.description}"` : ''}`)
    .join('\n');
  const membersStr = args.members
    .map((m) => `- id="${m.id}" name="${m.name ?? '(no name)'}" email="${m.email}"`)
    .join('\n');
  const recentTasksStr = args.recentTasks
    .map((t) => `- [${t.project.name}] ${t.title}`)
    .join('\n');

  return `# 会議情報
- タイトル: ${args.meetingTitle}
- 日時: ${meetingDateStr}
- 参加者: ${attendeesStr}

# プロジェクト候補
${projectsStr || '(プロジェクト未登録)'}

# ワークスペースメンバー
${membersStr || '(メンバー未登録)'}

# 直近のタスク例（プロジェクト内容理解の参考）
${recentTasksStr || '(タスクなし)'}

# 議事録
---
${args.transcript}
---`;
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  // YYYY-MM-DD or ISO
  const d = new Date(t.length === 10 ? `${t}T00:00:00.000Z` : t);
  return isNaN(d.getTime()) ? null : d;
}

function clamp01(n: number | null | undefined): number {
  if (typeof n !== 'number' || isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
