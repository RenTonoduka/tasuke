const LINE_API_BASE = 'https://api.line.me/v2/bot';

export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: FlexContainer };

export interface FlexContainer {
  type: 'bubble' | 'carousel';
  [key: string]: unknown;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
  };
}

export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  const res = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    console.error('[line] reply failed:', res.status, await res.text());
  }
}

export async function pushMessage(to: string, messages: LineMessage[]) {
  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    console.error('[line] push failed:', res.status, await res.text());
  }
}
