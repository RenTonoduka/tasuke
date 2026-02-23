'use client';

import { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Copy, Trash2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Token {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  workspace: { id: string; name: string };
}

interface ApiTokensClientProps {
  workspaceId: string;
}

export function ApiTokensClient({ workspaceId }: ApiTokensClientProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // フォーム
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read_only' | 'read_write'>('read_write');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/api-tokens');
      if (res.ok) setTokens(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/settings/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scope,
          workspaceId,
          ...(expiresInDays ? { expiresInDays: Number(expiresInDays) } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'トークン作成に失敗', description: err.error, variant: 'destructive' });
        return;
      }
      const data = await res.json();
      setNewToken(data.token);
      setName('');
      setScope('read_write');
      setExpiresInDays('');
      fetchTokens();
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    const res = await fetch('/api/settings/api-tokens', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId }),
    });
    if (res.ok) {
      toast({ title: 'トークンを無効化しました' });
      fetchTokens();
    } else {
      toast({ title: 'トークン無効化に失敗', variant: 'destructive' });
    }
  };

  const handleCopy = () => {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">APIトークン</h2>
            <p className="text-xs text-g-text-secondary">
              外部サービスからMCP接続するためのトークンを管理します
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => { setShowCreate(true); setNewToken(null); }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            新規発行
          </Button>
        </div>

        {/* 新規発行後のトークン表示 */}
        {newToken && (
          <div className="rounded-lg border border-[#34A853] bg-green-50 p-4">
            <p className="mb-2 text-sm font-medium text-[#34A853]">
              トークンが発行されました（この画面を閉じると二度と表示されません）
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-3 py-2 text-xs font-mono border">
                {newToken}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* 発行フォーム */}
        {showCreate && !newToken && (
          <div className="rounded-lg border border-g-border bg-g-surface p-4 space-y-3">
            <div>
              <label className="text-xs text-g-text-secondary">トークン名</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: Claude Code用"
                className="mt-1 w-full rounded border border-g-border px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-4">
              <div>
                <label className="text-xs text-g-text-secondary">スコープ</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as 'read_only' | 'read_write')}
                  className="mt-1 rounded border border-g-border px-2 py-1.5 text-sm"
                >
                  <option value="read_write">読み書き</option>
                  <option value="read_only">読み取り専用</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-g-text-secondary">有効期限（日）</label>
                <input
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
                  placeholder="無期限"
                  min={1}
                  max={365}
                  className="mt-1 w-24 rounded border border-g-border px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!name.trim() || creating}>
                {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                発行
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        )}

        {/* トークン一覧 */}
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-g-text-muted" />
            <span className="text-sm text-g-text-muted">読み込み中...</span>
          </div>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Key className="mb-3 h-10 w-10 text-g-border" />
            <p className="text-sm text-g-text-secondary">APIトークンがありません</p>
            <p className="mt-1 text-xs text-g-text-muted">
              「新規発行」からトークンを作成してください
            </p>
          </div>
        ) : (
          <div className="divide-y divide-g-border rounded-lg border border-g-border">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <Key className="h-4 w-4 text-g-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{t.name}</span>
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      t.scope === 'read_only'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700',
                    )}>
                      {t.scope === 'read_only' ? '読取専用' : '読み書き'}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-g-text-muted">
                    <span>
                      {t.tokenPrefix}
                    </span>
                    <span>
                      作成: {new Date(t.createdAt).toLocaleDateString('ja')}
                    </span>
                    {t.lastUsedAt && (
                      <span>最終利用: {new Date(t.lastUsedAt).toLocaleDateString('ja')}</span>
                    )}
                    {t.expiresAt && (
                      <span>
                        期限: {new Date(t.expiresAt).toLocaleDateString('ja')}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRevoke(t.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* 接続方法 */}
        <div className="rounded-lg border border-g-border bg-g-surface p-4">
          <h3 className="text-sm font-medium mb-2">MCP接続方法</h3>
          <p className="text-xs text-g-text-secondary mb-2">
            以下のエンドポイントにJSON-RPC 2.0リクエストを送信してください:
          </p>
          <code className="block rounded bg-white border px-3 py-2 text-xs font-mono mb-2">
            POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp
          </code>
          <p className="text-xs text-g-text-muted">
            ヘッダー: <code>Authorization: Bearer tsk_...</code>
          </p>
        </div>
      </div>
    </div>
  );
}
