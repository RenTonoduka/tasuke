interface MemberLite {
  id: string;
  name: string | null;
  email: string;
}

/**
 * 議事録の参加者文字列（"高須賀さん", "Ren Tonoduka", "user@example.com" 等）から
 * ワークスペースメンバーをマッチングする。
 *
 * 優先順:
 * 1. email完全一致
 * 2. name完全一致
 * 3. nameの正規化（敬称除去）後の包含マッチ
 */
export function matchMember(rawText: string | null | undefined, members: MemberLite[]): MemberLite | null {
  if (!rawText) return null;
  const text = rawText.trim();
  if (!text) return null;

  // 1. email
  if (text.includes('@')) {
    const lower = text.toLowerCase();
    const byEmail = members.find((m) => m.email.toLowerCase() === lower);
    if (byEmail) return byEmail;
  }

  // 2. exact name
  const byName = members.find((m) => m.name && m.name === text);
  if (byName) return byName;

  // 3. normalized partial match
  const norm = normalizeName(text);
  if (!norm) return null;
  const byNorm = members.find((m) => {
    if (!m.name) return false;
    const memberNorm = normalizeName(m.name);
    if (!memberNorm) return false;
    return memberNorm.includes(norm) || norm.includes(memberNorm);
  });
  return byNorm ?? null;
}

function normalizeName(s: string): string {
  return s
    .replace(/[\s　]+/g, '')
    .replace(/(さん|くん|ちゃん|様|氏|殿|先生)$/, '')
    .toLowerCase();
}
