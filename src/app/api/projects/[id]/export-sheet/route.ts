import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { getGoogleClient, getSheetsClient } from '@/lib/google';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const STATUS_LABELS: Record<string, string> = {
  TODO: '未着手',
  IN_PROGRESS: '進行中',
  DONE: '完了',
  ARCHIVED: 'アーカイブ',
};

const PRIORITY_LABELS: Record<string, string> = {
  P0: '緊急',
  P1: '高',
  P2: '中',
  P3: '低',
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspace: { members: { some: { userId: user.id } } },
      },
      include: {
        sections: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              where: { parentId: null },
              orderBy: { position: 'asc' },
              include: {
                assignees: {
                  include: { user: { select: { name: true } } },
                },
                _count: { select: { subtasks: true } },
              },
            },
          },
        },
      },
    });

    if (!project) return errorResponse('プロジェクトが見つかりません', 404);

    const auth = await getGoogleClient(user.id);
    const sheets = getSheetsClient(auth);

    const dateStr = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\//g, '');

    const spreadsheetTitle = `${project.name}_タスク一覧_${dateStr}`;

    // スプレッドシート新規作成
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: spreadsheetTitle },
        sheets: [{ properties: { title: 'タスク一覧', sheetId: 0 } }],
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId!;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // ヘッダー行
    const headers = ['タイトル', 'ステータス', '優先度', '担当者', '期限', 'セクション', 'サブタスク数', '作成日'];

    // セクション別にデータ行を組み立て
    const dataRows: string[][] = [];
    for (const section of project.sections) {
      for (const task of section.tasks) {
        const assigneeNames = task.assignees.map((a) => a.user.name ?? '').filter(Boolean).join(', ');
        const dueDate = task.dueDate
          ? new Date(task.dueDate).toLocaleDateString('ja-JP')
          : '';
        const createdAt = new Date(task.createdAt).toLocaleDateString('ja-JP');

        dataRows.push([
          task.title,
          STATUS_LABELS[task.status] ?? task.status,
          PRIORITY_LABELS[task.priority] ?? task.priority,
          assigneeNames,
          dueDate,
          section.name,
          String(task._count.subtasks),
          createdAt,
        ]);
      }
    }

    const allValues = [headers, ...dataRows];

    // 一括データ書き込み
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `タスク一覧!A1`,
            values: allValues,
          },
        ],
      },
    });

    const lastRow = allValues.length;
    const lastCol = headers.length; // 8列 = H

    // フォーマット適用
    const formatRequests: object[] = [
      // ヘッダー行: 太字・背景色#4285F4・白文字
      {
        repeatCell: {
          range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.259, green: 0.522, blue: 0.957 },
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
      // 列幅自動調整
      {
        autoResizeDimensions: {
          dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: lastCol },
        },
      },
    ];

    // DONE行に薄緑背景のconditionalFormatting
    if (lastRow > 1) {
      formatRequests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId: 0, startRowIndex: 1, endRowIndex: lastRow, startColumnIndex: 0, endColumnIndex: lastCol }],
            booleanRule: {
              condition: {
                type: 'TEXT_EQ',
                values: [{ userEnteredValue: '完了' }],
              },
              format: {
                backgroundColor: { red: 0.91, green: 0.961, blue: 0.914 },
              },
            },
          },
          index: 0,
        },
      });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });

    return successResponse({ spreadsheetId, spreadsheetUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
