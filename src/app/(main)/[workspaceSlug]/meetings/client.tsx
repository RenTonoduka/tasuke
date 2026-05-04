'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Loader2 } from 'lucide-react';

interface MeetingListItem {
  id: string;
  title: string;
  status: 'EXTRACTING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FAILED';
  source: 'MANUAL_PASTE' | 'DRIVE_WATCH';
  meetingDate: string | null;
  createdAt: string;
  approvedAt: string | null;
  failureReason: string | null;
  _count: { extractedTasks: number };
}

const statusLabel: Record<MeetingListItem['status'], string> = {
  EXTRACTING: '抽出中',
  PENDING_REVIEW: 'レビュー待ち',
  APPROVED: '承認済み',
  REJECTED: '却下済み',
  FAILED: 'エラー',
};

const statusBadgeClass: Record<MeetingListItem['status'], string> = {
  EXTRACTING: 'bg-blue-50 text-blue-700 border-blue-200',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-gray-50 text-gray-600 border-gray-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

export function MeetingsListClient({ workspaceId, workspaceSlug }: { workspaceId: string; workspaceSlug: string }) {
  const [items, setItems] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/meetings?workspaceId=${workspaceId}`);
        if (!res.ok) return;
        const data = (await res.json()) as MeetingListItem[];
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-g-text-secondary">
            議事録から抽出された行動アイテムをレビュー → 承認してタスク化します。
          </p>
          <Link href={`/${workspaceSlug}/meetings/extract`}>
            <Button>
              <Plus className="h-4 w-4" />
              議事録から抽出
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-g-text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            読み込み中...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-g-border bg-g-surface py-16 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-g-text-muted" />
            <p className="text-sm text-g-text-secondary">まだ議事録がありません</p>
            <Link href={`/${workspaceSlug}/meetings/extract`}>
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4" />
                最初の議事録を抽出する
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-g-border">
            <table className="w-full text-sm">
              <thead className="border-b border-g-border bg-g-surface text-left text-xs text-g-text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">タイトル</th>
                  <th className="px-4 py-2 font-medium">状態</th>
                  <th className="px-4 py-2 font-medium">抽出数</th>
                  <th className="px-4 py-2 font-medium">作成日時</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-b border-g-border last:border-b-0 hover:bg-g-surface/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${workspaceSlug}/meetings/${m.id}`}
                        className="font-medium text-g-text hover:underline"
                      >
                        {m.title}
                      </Link>
                      {m.status === 'FAILED' && m.failureReason && (
                        <p className="mt-0.5 text-xs text-red-600">{m.failureReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs ${statusBadgeClass[m.status]}`}
                      >
                        {statusLabel[m.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-g-text-secondary">{m._count.extractedTasks}件</td>
                    <td className="px-4 py-3 text-xs text-g-text-muted">
                      {new Date(m.createdAt).toLocaleString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
