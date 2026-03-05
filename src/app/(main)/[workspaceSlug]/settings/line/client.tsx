'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Bot, Bell, BellOff, Unlink, MessageCircle, Sparkles, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface LineStatus {
  connected: boolean;
  lineUserId: string | null;
  mapping: {
    displayName: string | null;
    isFollowing: boolean;
    reminderEnabled: boolean;
    linkingCode: string | null;
    createdAt: string;
  } | null;
}

export function LineSettingsClient() {
  const [status, setStatus] = useState<LineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/line/settings');
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch (error) {
      console.error('[line-settings] fetch error:', error);
    } finally {
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
    if (!confirm('LINE連携を解除しますか？\nAI秘書機能とリマインダーが無効になります。')) return;
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

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      {/* メインカード */}
      <div className="rounded-lg border border-g-border bg-g-bg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#06C755]/10">
            <Bot className="h-5 w-5 text-[#06C755]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-g-text">TASUKE AI秘書</h2>
            <p className="text-sm text-g-text-secondary">
              LINEからAIアシスタントでタスク管理できます
            </p>
          </div>
        </div>

        {!status?.connected ? (
          <div className="space-y-5">
            <div className="rounded-md bg-g-surface p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-g-text">
                <Sparkles className="h-4 w-4 text-[#06C755]" />
                AI秘書でできること
              </div>
              <ul className="space-y-2 text-sm text-g-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-[#06C755] mt-0.5">&#x2713;</span>
                  <span>自然言語でタスク操作<br /><span className="text-xs text-g-text-muted">「明日までに企画書タスク追加して」</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#06C755] mt-0.5">&#x2713;</span>
                  <span>Googleカレンダー連携<br /><span className="text-xs text-g-text-muted">「来週の予定を見せて」</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#06C755] mt-0.5">&#x2713;</span>
                  <span>毎朝9時のリマインダー通知</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#06C755] mt-0.5">&#x2713;</span>
                  <span>固定コマンドも対応<br /><span className="text-xs text-g-text-muted">「ダッシュボード」「マイタスク」等</span></span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => { window.location.href = '/api/line/connect'; }}
              className="w-full gap-2 bg-[#06C755] hover:bg-[#06C755]/90 text-white py-6 text-base"
            >
              <MessageCircle className="h-5 w-5" />
              TASUKE AI秘書とLINE接続
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-[#06C755]" />
              <span className="text-g-text">接続済み</span>
              {status.mapping?.displayName && (
                <span className="text-g-text-secondary">({status.mapping.displayName})</span>
              )}
            </div>

            {/* リンキングコード */}
            {status.mapping?.linkingCode && (
              <div className="rounded-md border border-[#06C755]/30 bg-[#06C755]/5 p-4 space-y-2">
                <p className="text-sm font-medium text-g-text">LINEボットとの連携</p>
                <p className="text-xs text-g-text-secondary">
                  LINE公式アカウントに以下のコードを送信してください
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-g-surface px-4 py-2.5 text-center text-xl font-mono font-bold tracking-[0.3em] text-g-text">
                    {status.mapping.linkingCode}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyCode(status.mapping!.linkingCode!)}
                    className="shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-[#06C755]" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {status.mapping && !status.mapping.isFollowing && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
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
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
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

      {/* AI秘書の使い方 */}
      <div className="rounded-lg border border-g-border bg-g-bg p-6">
        <h3 className="text-sm font-semibold text-g-text mb-3">AI秘書の使い方</h3>
        <div className="space-y-3 text-sm text-g-text-secondary">
          <p>LINE公式アカウントにメッセージを送るだけでAIが操作します:</p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-g-text-muted uppercase tracking-wide">自然言語（AI）</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>「明日までにレポート作成タスク追加して」</li>
              <li>「バグ修正のタスクを完了にして」</li>
              <li>「来週の予定を見せて」</li>
              <li>「今日のタスクの進捗は？」</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-g-text-muted uppercase tracking-wide">固定コマンド（高速）</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li><code className="text-g-text">ダッシュボード</code> — タスク概要</li>
              <li><code className="text-g-text">マイタスク</code> — 自分のタスク</li>
              <li><code className="text-g-text">追加 タスク名</code> — クイック追加</li>
              <li><code className="text-g-text">完了 タスク名</code> — タスク完了</li>
              <li><code className="text-g-text">検索 キーワード</code> — タスク検索</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
