/**
 * Gemini in Meet が生成する議事録Doc (text/plain export) を構造化パース。
 *
 * 典型構造:
 *   📝 メモ
 *   YYYY/MM/DD 会議名
 *
 *   概要
 *   ...summary...
 *
 *   次のステップ
 *   * [ユーザー名] タイトル: 詳細
 *
 *   詳細
 *   ...transcript...
 *
 * 行ベースで判定するためCRLF/プレーン見出し/Markdown見出し全対応。
 */

export interface ParsedMeetingDoc {
  format: 'gemini' | 'unknown';
  summary: string | null;
  actionItemsRaw: string | null;
  parsedActionItems: ParsedActionItem[];
  transcript: string | null;
  llmInput: string | null;
}

export interface ParsedActionItem {
  assigneeName: string | null;
  title: string;
  description: string | null;
  originalQuote: string;
}

const SECTION_KEYWORDS = {
  summary: ['会議の要点', 'TL;DR', 'Overview', 'Summary', '概要', '要約', 'サマリー'],
  actionItems: [
    '次のステップ',
    'Next Steps',
    'Next steps',
    'Action items',
    'Action Items',
    'アクションアイテム',
    'アクション項目',
    'Action list',
    'やること',
    'タスク',
    'Notes',
  ],
  transcript: [
    '文字起こし',
    '逐語録',
    'Transcript',
    'トランスクリプト',
    'Verbatim',
    '詳細',
  ],
};

type SectionKey = keyof typeof SECTION_KEYWORDS;

interface HeaderMatch {
  key: SectionKey;
  lineIdx: number;
}

function detectHeaders(lines: string[]): HeaderMatch[] {
  const found: HeaderMatch[] = [];
  const claimedKeys = new Set<SectionKey>();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Markdown見出し `# キーワード` を抽出した上でテキスト判定
    const md = trimmed.match(/^#{1,4}\s+(.+)$/);
    const headingText = md ? md[1].trim() : trimmed;

    let matched: SectionKey | null = null;
    for (const [key, kws] of Object.entries(SECTION_KEYWORDS) as [SectionKey, string[]][]) {
      if (claimedKeys.has(key)) continue;
      if (kws.some((kw) => kw === headingText)) {
        matched = key;
        break;
      }
    }
    if (!matched) continue;

    // false-positive 抑制: Markdown見出し OR 前の行が空 OR 文書頭
    const isHeading = !!md || i === 0 || (lines[i - 1] ?? '').trim() === '';
    if (!isHeading) continue;

    found.push({ key: matched, lineIdx: i });
    claimedKeys.add(matched);
  }

  return found;
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

  // CRLF・LF両対応で行分割
  const lines = raw.split(/\r\n|\r|\n/);
  const headers = detectHeaders(lines);

  if (headers.length < 1) return empty;

  const sections: Record<SectionKey, string | null> = {
    summary: null,
    actionItems: null,
    transcript: null,
  };

  for (let i = 0; i < headers.length; i++) {
    const cur = headers[i];
    const next = headers[i + 1];
    const startLine = cur.lineIdx + 1;
    const endLine = next ? next.lineIdx : lines.length;
    const body = lines.slice(startLine, endLine).join('\n').trim();
    if (body) sections[cur.key] = body;
  }

  const parsedActionItems = sections.actionItems
    ? parseActionItems(sections.actionItems)
    : [];

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
 * 「次のステップ」セクションの構造化抽出。
 * 対応:
 *   * [Name] タイトル: 詳細
 *   * [Name1, Name2] タイトル
 *   - [@user] ...
 *   1. [Name] ...
 */
function parseActionItems(text: string): ParsedActionItem[] {
  const items: ParsedActionItem[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  // 複数行の項目をマージするためのバッファ
  let current: string | null = null;

  const flush = (line: string | null) => {
    if (!line) return;
    const trimmed = line.trim();
    if (!trimmed) return;

    // bullet除去
    const bulletStripped = trimmed.replace(/^(?:[\*\-•・◦]|\d+[.)）])\s+/, '');

    // [Name] タイトル: 詳細
    const bracket = /^\[([^\]]+)\]\s*(.+?)(?::\s*(.+))?$/.exec(bulletStripped);
    if (bracket) {
      const rawName = bracket[1].trim();
      const titlePart = bracket[2].trim();
      const descPart = bracket[3]?.trim() ?? null;
      const assigneeName = rawName.startsWith('@') ? rawName.slice(1) : rawName;
      items.push({
        assigneeName: assigneeName || null,
        title: titlePart.slice(0, 200),
        description: descPart,
        originalQuote: trimmed.slice(0, 200),
      });
    } else if (bulletStripped.length >= 4) {
      items.push({
        assigneeName: null,
        title: bulletStripped.slice(0, 200),
        description: null,
        originalQuote: trimmed.slice(0, 200),
      });
    }
  };

  for (const ln of lines) {
    const trimmed = ln.trim();
    // 空行 → 直前の項目を確定
    if (!trimmed) {
      flush(current);
      current = null;
      continue;
    }
    // bulletで始まる行 = 新項目開始
    if (/^(?:[\*\-•・◦]|\d+[.)）])\s+/.test(trimmed)) {
      flush(current);
      current = trimmed;
    } else if (current) {
      // 継続行（インデント等）
      current += ' ' + trimmed;
    } else {
      // bulletなし単独行も項目として扱う（条件付き）
      flush(trimmed);
    }
  }
  flush(current);
  return items;
}
