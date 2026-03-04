const LINE_API_BASE = 'https://api.line.me/v2/bot';

export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: FlexContainer };

export interface FlexContainer {
  type: 'bubble' | 'carousel';
  [key: string]: unknown;
}

function getChannelAccessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  return token;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getChannelAccessToken()}`,
  };
}

export async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<boolean> {
  try {
    const res = await fetch(`${LINE_API_BASE}/message/reply`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ replyToken, messages }),
    });
    if (!res.ok) {
      console.error('[line] reply failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('[line] reply error:', error);
    return false;
  }
}

export async function pushMessage(to: string, messages: LineMessage[]): Promise<boolean> {
  try {
    const res = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ to, messages }),
    });
    if (!res.ok) {
      console.error('[line] push failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('[line] push error:', error);
    return false;
  }
}
