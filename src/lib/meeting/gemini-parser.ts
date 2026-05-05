/**
 * Gemini in Meet が生成する議事録Doc (text/plain export) を構造化パース。
 * 典型構造:
 *   # 会議名
 *   ## 要約 / Summary
 *   ...
 *   ## メモ / アクションアイテム / Action items / Notes
 *   - @ユーザー: タスク
 *   ...
 *   ## 文字起こし / Transcript
 *   00:00:30 山田: ...
 *
 * パース失敗時は format='unknown' を返し呼び出し側で全文fallback。
 */

export interface ParsedMeetingDoc {
  format: 'gemini' | 'unknown';
  summary: string | null;
  actionItemsRaw: string | null;
  transcript: string | null;
  /** LLMに渡す効率化済みテキスト（summary + actionItems）。null時は全文を渡す */
  llmInput: string | null;
}

const SECTION_PATTERNS: Array<{ key: 'summary' | 'actionItems' | 'transcript'; regex: RegExp }> = [
  {
    key: 'summary',
    regex: /^#{1,3}\s*(?:要約|サマリー|概要|会議の要点|Summary|Overview|TL;DR)\s*$/im,
  },
  {
    key: 'actionItems',
    regex: /^#{1,3}\s*(?:メモ|アクションアイテム|アクション項目|やること|タスク|Action\s*items?|Notes|Action\s*list)\s*$/im,
  },
  {
    key: 'transcript',
    regex: /^#{1,3}\s*(?:文字起こし|逐語録|議事録|議事|トランスクリプト|Transcript|Verbatim)\s*$/im,
  },
];

interface SectionMatch {
  key: 'summary' | 'actionItems' | 'transcript';
  start: number; // header開始位置
  contentStart: number; // header改行直後
}

export function parseMeetingDoc(raw: string): ParsedMeetingDoc {
  if (!raw || raw.length < 50) {
    return { format: 'unknown', summary: null, actionItemsRaw: null, transcript: null, llmInput: null };
  }

  const matches: SectionMatch[] = [];
  for (const pattern of SECTION_PATTERNS) {
    const m = pattern.regex.exec(raw);
    if (m && m.index !== undefined) {
      const headerEnd = raw.indexOf('\n', m.index);
      matches.push({
        key: pattern.key,
        start: m.index,
        contentStart: headerEnd === -1 ? m.index + m[0].length : headerEnd + 1,
      });
    }
  }

  // 1セクションも見つからなければ未知形式
  if (matches.length < 1) {
    return { format: 'unknown', summary: null, actionItemsRaw: null, transcript: null, llmInput: null };
  }

  // 開始位置でソート → 各セクションの終端 = 次セクションの開始
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

  // LLM入力 = summary + actionItems（短くて構造的、コスト効率良）
  const parts: string[] = [];
  if (sections.summary) parts.push(`【会議要約】\n${sections.summary}`);
  if (sections.actionItems) parts.push(`【アクションアイテム】\n${sections.actionItems}`);
  const llmInput = parts.length > 0 ? parts.join('\n\n') : null;

  // summary or actionItems の少なくとも一方が見つかったらgemini形式と判定
  const isGemini = !!(sections.summary || sections.actionItems);

  return {
    format: isGemini ? 'gemini' : 'unknown',
    summary: sections.summary,
    actionItemsRaw: sections.actionItems,
    transcript: sections.transcript,
    llmInput,
  };
}
