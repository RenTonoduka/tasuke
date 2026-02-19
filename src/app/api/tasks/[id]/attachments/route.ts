import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getGoogleClient, getDriveClient } from '@/lib/google';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const attachSchema = z.object({
  driveFileId: z.string().min(10).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});

async function getTaskWithAuth(taskId: string, userId: string) {
  return prisma.task.findFirst({
    where: {
      id: taskId,
      project: { workspace: { members: { some: { userId } } } },
    },
  });
}

async function getTaskWithWriteAuth(taskId: string, userId: string) {
  return prisma.task.findFirst({
    where: {
      id: taskId,
      project: {
        workspace: {
          members: { some: { userId, role: { not: 'VIEWER' } } },
        },
      },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const task = await getTaskWithAuth(params.id, user.id);
    if (!task) return errorResponse('タスクが見つかりません', 404);

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(attachments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const task = await getTaskWithWriteAuth(params.id, user.id);
    if (!task) return errorResponse('タスクが見つかりません', 404);

    const body = await req.json();
    const parsed = attachSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('driveFileId の形式が不正です', 400);
    }
    const { driveFileId } = parsed.data;

    let auth;
    try {
      auth = await getGoogleClient(user.id);
    } catch {
      return errorResponse('Googleアカウントが連携されていません', 400);
    }

    const drive = getDriveClient(auth);
    let fileData;
    try {
      const res = await drive.files.get({
        fileId: driveFileId,
        fields: 'id,name,mimeType,webViewLink,iconLink,size',
      });
      fileData = res.data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Drive file get error:', e);
      if (msg.includes('404') || msg.includes('not found')) {
        return errorResponse('指定されたファイルが見つかりません', 404);
      }
      if (msg.includes('403') || msg.includes('forbidden')) {
        return errorResponse('このファイルへのアクセス権限がありません', 403);
      }
      return errorResponse('Googleドライブのファイル取得に失敗しました', 500);
    }

    if (!fileData.name || !fileData.mimeType || !fileData.webViewLink) {
      return errorResponse('ファイル情報の取得に失敗しました', 500);
    }

    const existing = await prisma.taskAttachment.findFirst({
      where: { taskId: params.id, driveFileId },
    });
    if (existing) return errorResponse('このファイルはすでに添付されています', 409);

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: params.id,
        userId: user.id,
        driveFileId,
        name: fileData.name,
        mimeType: fileData.mimeType,
        url: fileData.webViewLink,
        iconUrl: fileData.iconLink ?? null,
        size: fileData.size ? parseInt(fileData.size, 10) : null,
      },
    });

    return successResponse(attachment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
