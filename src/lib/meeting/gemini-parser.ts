/**
 * Gemini in Meet が生成する議事録Doc (text/plain export) を構造化パース。
 *
 * 典型構造（プレーン見出し+前後空行）:
 *   📝 メモ
 *   YYYY/MM/DD 会議名
 *
 *   概要
 *   ...summary...
 *
 *   次のステップ
 *   * [ユーザー名] タイトル: 詳細
 *   * [@user] ...
 *
 *   詳細
 *   ...transcript with speakers...
 *
 * Markdown形式 `# ##` も対応。
 *
 * パース失敗時は format='unknown' を返し呼び出し側で全文fallback。
 */

export interface ParsedMeetingDoc {
  format: 'gemini' | 'unknown';
  summary: string | null;
  actionItemsRaw: string | null;
  /** 「次のステップ」セクションから直接構造化抽出したaction item群（LLM不要） */
  parsedActionItems: ParsedActionItem[];
  transcript: string | null;
  /** LLMに渡す効率化済みテキスト（summary + actionItems）。null時は全文を渡す */
  llmInput: string | null;
}

export interface ParsedActionItem {
  /** 担当者の生テキスト名（例: "Ren Tonozuka", "戸野塚蓮", "@user", "グループ"） */
  assigneeName: string | null;
  /** タスクのタイトル（コロンの前） */
  title: string;
  /** 詳細（コロンの後・複数行可） */
  description: string | null;
  /** 元テキスト全体（traceability） */
  originalQuote: string;
}

// 見出しキーワード（順序: 後段ほど先にマッチさせるため長い表現から）
const SECTION_KEYWORDS = {
  summary: ['会議の要点', 'TL;DR', 'Overview', 'Summary', '概要', '要約', 'サマリー'],
  actionItems: [
    '次のステップ',
    'Next Steps',
    'Action items',
    'Action Items',
    'アクションアイテム',
    'アクション項目',
    'Action list',
    'やること',
    'メモ',
    'Notes',
  ],
  transcript: ['文字起こし', '逐語録', 'Transcript', '議事録', '議事', 'トランスクリプト', 'Verbatim', '詳細'],
};

interface SectionMatch {
  key: 'summary' | 'actionItems' | 'transcript';
  start: number;
  contentStart: number;
}

/**
 * 行頭で「キーワード単独」または `# ## ### キーワード` 形式の見出しを検出。
 * 前後に空行（または文書頭尾）があることを要求して誤検出を抑える。
 */
function findSectionHeader(raw: string, keyword: string): { start: number; contentStart: number } | null {
  // パターン1: Markdown見出し `# キーワード`
  const md = new RegExp(`^#{1,4}\\s*${escapeRegex(keyword)}\\s*$`, 'im').exec(raw);
  if (md && md.index !== undefined) {
    const headerEnd = raw.indexOf('\n', md.index);
    return {
      start: md.index,
      contentStart: headerEnd === -1 ? md.index + md[0].length : headerEnd + 1,
    };
  }

  // パターン2: プレーン見出し（前後空行で挟まれた単独行）
  // (?:^|\n)\n?キーワード\n(?:\n|本文)
  const plain = new RegExp(`(?:^|\\n)\\s*${escapeRegex(keyword)}\\s*\\n`, 'm').exec(raw);
  if (plain && plain.index !== undefined) {
    // 当該行の前1-2行が空行 or 文書頭であることを確認（false positive防御）
    const lineStart = raw.lastIndexOf('\n', plain.index) + 1;
    const prevLineStart = raw.lastIndexOf('\n', lineStart - 2);
    const prevLine = prevLineStart >= 0 ? raw.slice(prevLineStart + 1, lineStart - 1) : '';
    // 前の行が空 or 文書頭なら見出しとみなす
    if (lineStart === 0 || prevLine.trim() === '' || prevLineStart < 0) {
      const matchStart = raw.indexOf(keyword, plain.index);
      if (matchStart >= 0) {
        const headerEnd = raw.indexOf('\n', matchStart);
        return {
          start: matchStart,
          contentStart: headerEnd === -1 ? matchStart + keyword.length : headerEnd + 1,
        };
      }
    }
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseMeetingDoc(raw: string): ParsedMeetingDoc {
  const empty: ParsedMeetingDoc = {
    format: 'unknown',
    summary: null,
    actionItemsRaw: null,
    parsedActionItems: [],
    transcript: null,
    llmInput: null,
  };
  if (!raw || raw.length < 50) return empty;

  const matches: SectionMatch[] = [];
  for (const [key, keywords] of Object.entries(SECTION_KEYWORDS) as Array<[keyof typeof SECTION_KEYWORDS, string[]]>) {
    for (const kw of keywords) {
      const h = findSectionHeader(raw, kw);
      if (h) {
        matches.push({ key, ...h });
        break; // セクション毎に最初の見出しを採用
      }
    }
  }

  if (matches.length < 1) return empty;

  matches.sort((a, b) => a.start - b.start);

  const sections: Record<'summary' | 'actionItems' | 'transcript', string | null> = {
    summary: null,
    actionItems: null,
    transcript: null,
  };

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const end = next ? next.start : raw.length;
    const body = raw.slice(cur.contentStart, end).trim();
    if (body) sections[cur.key] = body;
  }

  // アクションアイテムを構造化抽出
  const parsedActionItems = sections.actionItems
    ? parseActionItems(sections.actionItems)
    : [];

  // LLM入力 = summary + actionItems（短くて構造的、コスト効率良）
  const parts: string[] = [];
  if (sections.summary) parts.push(`【会議要約】\n${sections.summary}`);
  if (sections.actionItems) parts.push(`【アクションアイテム】\n${sections.actionItems}`);
  const llmInput = parts.length > 0 ? parts.join('\n\n') : null;

  const isGemini = !!(sections.summary || sections.actionItems);

  return {
    format: isGemini ? 'gemini' : 'unknown',
    summary: sections.summary,
    actionItemsRaw: sections.actionItems,
    parsedActionItems,
    transcript: sections.transcript,
    llmInput,
  };
}

/**
 * 「次のステップ」セクションのテキストから個別アクションを抽出。
 *
 * 対応フォーマット:
 *   * [Ren Tonozuka] タイトル: 詳細
 *   * [Ren Tonozuka, Tatsuya Sakamoto] タイトル: 詳細
 *   * [@user] タイトル: 詳細
 *   * [グループ] タイトル: 詳細
 *   - [Name] Title: detail
 *   • [Name] Title
 *   1. [Name] Title: detail
 */
function parseActionItems(text: string): ParsedActionItem[] {
  const items: ParsedActionItem[] = [];
  // 行頭の bullet: *, -, •, 1. 等を許容
  const lineRegex = /^[\s]*(?:[\*\-•・◦]|\d+[.)）])\s+(.+?)$/gm;
  let m;
  while ((m = lineRegex.exec(text)) !== null) {
    const line = m[1].trim();
    // [名前] タイトル: 詳細  形式
    const bracketMatch = /^\[([^\]]+)\]\s*(.+?)(?::\s*(.+))?$/.exec(line);
    if (bracketMatch) {
      const assigneeName = bracketMatch[1].trim();
      const titlePart = bracketMatch[2].trim();
      const descPart = bracketMatch[3]?.trim() ?? null;
      items.push({
        assigneeName: assigneeName.startsWith('@') ? assigneeName.slice(1) : assigneeName,
        title: titlePart,
        description: descPart,
        originalQuote: line.slice(0, 200),
      });
    } else {
      // [なし] タイトル のみ（担当者不明）
      items.push({
        assigneeName: null,
        title: line.slice(0, 200),
        description: null,
        originalQuote: line.slice(0, 200),
      });
    }
  }
  return items;
}
