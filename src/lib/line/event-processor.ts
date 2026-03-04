import prisma from '@/lib/prisma';
import { replyMessage } from './client';
import { handleLineMessage } from './message-handler';

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source: { type: string; userId: string };
  message?: { type: string; text: string };
}

export async function processLineEvent(event: LineWebhookEvent) {
  switch (event.type) {
    case 'message':
      if (event.message?.type === 'text' && event.replyToken) {
        await handleLineMessage({
          replyToken: event.replyToken,
          lineUserId: event.source.userId,
          text: event.message.text,
        });
      }
      break;

    case 'follow':
      await handleFollow(event);
      break;

    case 'unfollow':
      await handleUnfollow(event);
      break;
  }
}

async function handleFollow(event: LineWebhookEvent) {
  const lineUserId = event.source.userId;

  const mapping = await prisma.lineUserMapping.findUnique({
    where: { lineUserId },
  });

  if (mapping) {
    await prisma.lineUserMapping.update({
      where: { lineUserId },
      data: { isFollowing: true },
    });
    if (event.replyToken) {
      await replyMessage(event.replyToken, [{
        type: 'text',
        text: 'おかえりなさい！タス助LINEボットです。\nタスク管理をLINEから行えます。\n\n「ヘルプ」と送信してコマンド一覧を確認できます。',
      }]);
    }
  } else {
    if (event.replyToken) {
      await replyMessage(event.replyToken, [{
        type: 'text',
        text: 'タス助LINEボットへようこそ！\n\nまずWebアプリからLINEログインで連携してください。\nhttps://tasuke-nu.vercel.app/login',
      }]);
    }
  }
}

async function handleUnfollow(event: LineWebhookEvent) {
  await prisma.lineUserMapping.updateMany({
    where: { lineUserId: event.source.userId },
    data: { isFollowing: false },
  });
}
