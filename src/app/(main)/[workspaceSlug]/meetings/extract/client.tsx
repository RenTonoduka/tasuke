'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';

export function ExtractClient({ workspaceId, workspaceSlug }: { workspaceId: string; workspaceSlug: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: 'タイトルを入力してください', variant: 'destructive' });
      return;
    }
    if (transcript.trim().length < 10) {
      toast({ title: '議事録本文が短すぎます', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings/extract?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          transcript,
          meetingDate: meetingDate ? new Date(meetingDate).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: '抽出に失敗しました', description: err.error ?? '', variant: 'destructive' });
        return;
      }
      const data = (await res.json()) as { meetingId: string; extractedCount: number };
      toast({ title: `${data.extractedCount}件のタスク候補を抽出しました` });
      router.push(`/${workspaceSlug}/meetings/${data.meetingId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm text-g-text-secondary">
          議事録のテキストを貼り付けてください。AIが行動アイテムを抽出し、担当者・プロジェクト・期日を提案します。
        </p>

        <div className="space-y-1">
          <label className="text-xs font-medium text-g-text">会議タイトル <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 週次定例 2026-05-04"
            className="w-full rounded-md border border-g-border bg-white px-3 py-2 text-sm focus:border-[#4285F4] focus:outline-none"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-g-text">会議日</label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="rounded-md border border-g-border bg-white px-3 py-2 text-sm focus:border-[#4285F4] focus:outline-none"
            disabled={loading}
          />
          <p className="text-xs text-g-text-muted">期日表現（「来週金曜」等）の解決基準日になります</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-g-text">議事録本文 <span className="text-red-500">*</span></label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="議事録（最大5万字）をペーストしてください..."
            rows={20}
            className="w-full rounded-md border border-g-border bg-white px-3 py-2 font-mono text-xs leading-relaxed focus:border-[#4285F4] focus:outline-none"
            disabled={loading}
          />
          <p className="text-xs text-g-text-muted">{transcript.length.toLocaleString()} / 50,000 字</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                抽出中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                タスクを抽出
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
