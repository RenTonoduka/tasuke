'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface ChannelInfo {
  id: string;
  enabled: boolean;
  expiration: string;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function DriveWatchClient({ workspaceId }: { workspaceId: string; workspaceSlug: string }) {
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/drive-watch?workspaceId=${workspaceId}`);
      if (!res.ok) {
        toast({ title: '読み込みに失敗しました', variant: 'destructive' });
        return;
      }
      const data = (await res.json()) as { channel: ChannelInfo | null };
      setChannel(data.channel);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const enable = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/drive-watch/enable?workspaceId=${workspaceId}`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: '有効化に失敗しました', description: json.error ?? '', variant: 'destructive' });
        return;
      }
      toast({ title: 'Drive自動取込を有効化しました' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!confirm('Drive自動取込を無効化します。よろしいですか？')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/drive-watch?workspaceId=${workspaceId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast({ title: '無効化に失敗しました', variant: 'destructive' });
        return;
      }
      toast({ title: 'Drive自動取込を無効化しました' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-lg border border-g-border bg-g-surface p-4">
          <h2 className="text-base font-semibold">Drive自動取込（議事録）</h2>
          <p className="mt-2 text-sm text-g-text-secondary">
            あなたの My Drive を監視し、Gemini in Meet が生成する議事録Google Docを自動検出 → AIがタスクを抽出して
            <code className="mx-1 rounded bg-g-surface px-1">/[ws]/meetings</code>
            に追加します。
          </p>
          <ul className="mt-3 list-inside list-disc space-y-0.5 text-xs text-g-text-muted">
            <li>有効化前に Workspace 管理者で「Gemini in Meet（Take notes for me）」が有効である必要があります</li>
            <li>取込対象: Google Doc で名前に「議事録 / Meeting notes / Transcript」を含むファイル</li>
            <li>Shared Drive上のファイルは現状対象外（My Driveのみ）</li>
            <li>監視チャネルは7日で期限切れ。サーバ側で自動更新します</li>
          </ul>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-g-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中...
          </div>
        ) : channel?.enabled ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-emerald-800">有効化済み</p>
                <p className="text-xs text-emerald-700">
                  期限: {new Date(channel.expiration).toLocaleString('ja-JP')}
                </p>
                {channel.lastNotifiedAt && (
                  <p className="text-xs text-emerald-700">
                    最終通知: {new Date(channel.lastNotifiedAt).toLocaleString('ja-JP')}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={enable} disabled={busy}>
                <RefreshCw className="h-3.5 w-3.5" />
                再登録（renew）
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={disable}
                disabled={busy}
                className="text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                無効化
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-g-border bg-white p-4">
            <p className="text-sm text-g-text">現在無効です</p>
            <Button onClick={enable} disabled={busy} className="mt-3">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  処理中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  有効化する
                </>
              )}
            </Button>
            <p className="mt-2 text-xs text-g-text-muted">
              ※ Googleアカウントの再認証が必要な場合、有効化失敗時に「再ログインしてください」と表示されます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
