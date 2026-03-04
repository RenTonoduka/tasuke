'use client';

import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { Loader2, MessageCircle, Bell, BellOff, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface LineStatus {
  connected: boolean;
  lineUserId: string | null;
  mapping: {
    displayName: string | null;
    isFollowing: boolean;
    reminderEnabled: boolean;
    createdAt: string;
  } | null;
}

export function LineSettingsClient() {
  const [status, setStatus] = useState<LineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/line/settings');
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const toggleReminder = async () => {
    if (!status?.mapping) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/line/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderEnabled: !status.mapping.reminderEnabled }),
      });
      if (res.ok) {
        await fetchStatus();
        toast({ title: 'リマインダー設定を更新しました' });
      }
    } catch {
      toast({ title: '更新に失敗しました', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('LINE連携を解除しますか？\nLINEからのタスク操作とリマインダーが無効になります。')) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/line/settings', { method: 'DELETE' });
      if (res.ok) {
        await fetchStatus();
        toast({ title: 'LINE連携を解除しました' });
      }
    } catch {
      toast({ title: '解除に失敗しました', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-g-text-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="rounded-lg border border-g-border bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#06C755]/10">
            <MessageCircle className="h-5 w-5 text-[#06C755]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-g-text">LINE連携</h2>
            <p className="text-sm text-g-text-secondary">
              LINEからタスク管理やリマインダー通知を受け取れます
            </p>
          </div>
        </div>

        {!status?.connected ? (
          <div className="space-y-4">
            <p className="text-sm text-g-text-secondary">
              LINEアカウントを連携すると、LINE公式アカウントからタスクの追加・完了・検索やリマインダー通知が利用できます。
            </p>
            <Button
              onClick={() => signIn('line', { callbackUrl: window.location.href })}
              className="gap-2 bg-[#06C755] hover:bg-[#06C755]/90 text-white"
            >
              <MessageCircle className="h-4 w-4" />
              LINEで連携する
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-[#06C755]" />
              <span className="text-g-text">連携済み</span>
              {status.mapping?.displayName && (
                <span className="text-g-text-secondary">({status.mapping.displayName})</span>
              )}
            </div>

            {status.mapping && !status.mapping.isFollowing && (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                LINE公式アカウントがブロックされています。LINEアプリからブロック解除してください。
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border border-g-border p-4">
              <div className="flex items-center gap-3">
                {status.mapping?.reminderEnabled ? (
                  <Bell className="h-5 w-5 text-[#06C755]" />
                ) : (
                  <BellOff className="h-5 w-5 text-g-text-muted" />
                )}
                <div>
                  <p className="text-sm font-medium text-g-text">毎朝リマインダー</p>
                  <p className="text-xs text-g-text-secondary">
                    毎朝9時に期限切れ・今日・明日期限のタスクを通知
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleReminder}
                disabled={updating}
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : status.mapping?.reminderEnabled ? 'OFF' : 'ON'}
              </Button>
            </div>

            <div className="pt-2 border-t border-g-border">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={disconnect}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
                連携を解除
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-g-border bg-white p-6">
        <h3 className="text-sm font-semibold text-g-text mb-3">LINEボットの使い方</h3>
        <div className="space-y-2 text-sm text-g-text-secondary">
          <p>LINE公式アカウントに以下のコマンドを送信してください:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li><code className="text-g-text">ダッシュボード</code> — タスク概要を表示</li>
            <li><code className="text-g-text">マイタスク</code> — 自分のタスク一覧</li>
            <li><code className="text-g-text">追加 タスク名</code> — タスクを追加</li>
            <li><code className="text-g-text">完了 タスク名</code> — タスクを完了に</li>
            <li><code className="text-g-text">検索 キーワード</code> — タスクを検索</li>
            <li><code className="text-g-text">ヘルプ</code> — コマンド一覧</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
