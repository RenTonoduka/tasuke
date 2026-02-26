'use client';

import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { Github, Loader2, Trash2, CheckCircle2, RefreshCw, Webhook, Users, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface RepoMapping {
  id: string;
  githubRepoFullName: string;
  projectId: string;
  webhookId: number | null;
  project: { name: string; color: string };
}

interface UserMapping {
  id: string;
  githubLogin: string;
  userId: string;
  user?: { name: string | null; email: string };
}

interface WorkspaceMember {
  userId: string;
  user: { id: string; name: string | null; email: string };
}

interface GitHubSettingsClientProps {
  workspaceSlug: string;
  workspaceId: string;
}

export function GitHubSettingsClient({ workspaceSlug, workspaceId }: GitHubSettingsClientProps) {
  const [connected, setConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [repoMappings, setRepoMappings] = useState<RepoMapping[]>([]);
  const [userMappings, setUserMappings] = useState<UserMapping[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [syncingRepo, setSyncingRepo] = useState<string | null>(null);
  const [settingUpWebhook, setSettingUpWebhook] = useState<string | null>(null);
  const [newGithubLogin, setNewGithubLogin] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [addingMapping, setAddingMapping] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/github/integration');
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        setGithubUsername(data.githubUsername ?? null);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const fetchRepoMappings = useCallback(async () => {
    try {
      const res = await fetch(`/api/github/mappings?workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setRepoMappings(data.mappings ?? []);
      }
    } catch {}
  }, [workspaceId]);

  const fetchUserMappings = useCallback(async () => {
    try {
      const res = await fetch(`/api/github/user-mappings?workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setUserMappings(data.mappings ?? []);
      }
    } catch {}
  }, [workspaceId]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (res.ok) setMembers(await res.json());
    } catch {}
  }, [workspaceId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (connected) {
      fetchRepoMappings();
      fetchUserMappings();
      fetchMembers();
    }
  }, [connected, fetchRepoMappings, fetchUserMappings, fetchMembers]);

  const handleConnect = () => {
    signIn('github', { callbackUrl: `/${workspaceSlug}/settings/github` });
  };

  const handleDisconnect = async () => {
    setDeleting(true);
    try {
      await fetch('/api/github/integration', { method: 'DELETE' });
      setConnected(false);
      setGithubUsername(null);
      toast({ title: 'GitHub連携を解除しました' });
    } catch {
      toast({ title: '解除に失敗しました', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleFullSync = async (repoFullName: string, projectId: string) => {
    setSyncingRepo(repoFullName);
    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubRepoFullName: repoFullName, projectId, workspaceId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast({ title: `同期完了: ${data.created}件作成, ${data.updated}件更新（全${data.total}件）` });
    } catch {
      toast({ title: '同期に失敗しました', variant: 'destructive' });
    } finally {
      setSyncingRepo(null);
    }
  };

  const handleSetupWebhook = async (repoFullName: string) => {
    setSettingUpWebhook(repoFullName);
    try {
      const res = await fetch('/api/github/webhook/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubRepoFullName: repoFullName, workspaceId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Webhook登録失敗');
      }
      const data = await res.json();
      toast({ title: data.alreadyExists ? 'Webhook登録済みです' : 'Webhookを登録しました' });
      fetchRepoMappings();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Webhook登録に失敗しました', variant: 'destructive' });
    } finally {
      setSettingUpWebhook(null);
    }
  };

  const handleAddUserMapping = async () => {
    if (!newGithubLogin.trim() || !newUserId) return;
    setAddingMapping(true);
    try {
      const res = await fetch('/api/github/user-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, githubLogin: newGithubLogin.trim(), userId: newUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '追加失敗');
      }
      setNewGithubLogin('');
      setNewUserId('');
      fetchUserMappings();
      toast({ title: 'ユーザーマッピングを追加しました' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : '追加に失敗しました', variant: 'destructive' });
    } finally {
      setAddingMapping(false);
    }
  };

  const handleDeleteUserMapping = async (id: string) => {
    try {
      await fetch(`/api/github/user-mappings?id=${id}`, { method: 'DELETE' });
      fetchUserMappings();
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-g-text-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* 接続状態 */}
      <div className="rounded-lg border border-g-border bg-g-surface p-6">
        <div className="flex items-center gap-3 mb-6">
          <Github className="h-6 w-6 text-g-text" />
          <div>
            <h2 className="text-base font-semibold text-g-text">GitHub連携</h2>
            <p className="text-xs text-g-text-muted">
              GitHubアカウントを連携してIssueを双方向同期します
            </p>
          </div>
        </div>

        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md bg-green-500/10 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-g-text">
                  連携中{githubUsername ? `: @${githubUsername}` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={deleting}
                className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span className="ml-1">解除</span>
              </Button>
            </div>

            <div className="rounded-md bg-g-bg px-4 py-3">
              <p className="text-sm text-g-text">
                <a href={`/${workspaceSlug}/import-github`} className="text-[#4285F4] hover:underline">
                  GitHub Issues取り込みページ →
                </a>
                からIssueを取り込めます。
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={handleConnect}
              className="w-full gap-3 bg-[#24292e] text-white hover:bg-[#1b1f23]"
            >
              <Github className="h-5 w-5" />
              GitHubと連携する
            </Button>
            <p className="text-center text-xs text-g-text-muted">
              GitHubのOAuth認証画面が開きます。リポジトリへのアクセス権限を許可してください。
            </p>
          </div>
        )}
      </div>

      {/* リポジトリ同期設定 */}
      {connected && repoMappings.length > 0 && (
        <div className="rounded-lg border border-g-border bg-g-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="h-5 w-5 text-g-text" />
            <div>
              <h3 className="text-sm font-semibold text-g-text">リポジトリ同期</h3>
              <p className="text-xs text-g-text-muted">マッピング済みリポジトリの同期設定</p>
            </div>
          </div>

          <div className="space-y-3">
            {repoMappings.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-md border border-g-border/60 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-g-text">{m.githubRepoFullName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: m.project.color }}
                    />
                    <span className="text-xs text-g-text-muted">{m.project.name}</span>
                    {m.webhookId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-600">
                        <Webhook className="h-2.5 w-2.5" />
                        Webhook有効
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!m.webhookId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetupWebhook(m.githubRepoFullName)}
                      disabled={settingUpWebhook === m.githubRepoFullName}
                      className="text-xs"
                    >
                      {settingUpWebhook === m.githubRepoFullName ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Webhook className="mr-1 h-3 w-3" />
                      )}
                      Webhook登録
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFullSync(m.githubRepoFullName, m.projectId)}
                    disabled={syncingRepo === m.githubRepoFullName}
                    className="text-xs"
                  >
                    {syncingRepo === m.githubRepoFullName ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    全Issue同期
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ユーザーマッピング設定 */}
      {connected && (
        <div className="rounded-lg border border-g-border bg-g-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-5 w-5 text-g-text" />
            <div>
              <h3 className="text-sm font-semibold text-g-text">ユーザーマッピング</h3>
              <p className="text-xs text-g-text-muted">GitHubユーザーとTasukeユーザーの紐付け（担当者同期用）</p>
            </div>
          </div>

          {userMappings.length > 0 && (
            <div className="mb-4 space-y-2">
              {userMappings.map((um) => (
                <div key={um.id} className="flex items-center gap-3 rounded-md bg-g-bg px-3 py-2">
                  <Github className="h-4 w-4 text-g-text-muted" />
                  <span className="text-sm text-g-text">@{um.githubLogin}</span>
                  <span className="text-xs text-g-text-muted">↔</span>
                  <span className="text-sm text-g-text">{um.user?.name ?? um.user?.email ?? um.userId}</span>
                  <button
                    onClick={() => handleDeleteUserMapping(um.id)}
                    className="ml-auto rounded p-1 text-g-text-muted hover:bg-g-border hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              value={newGithubLogin}
              onChange={(e) => setNewGithubLogin(e.target.value)}
              placeholder="GitHubユーザー名"
              className="h-8 w-36 rounded-md border border-g-border bg-white px-2.5 text-xs text-g-text outline-none focus:border-[#4285F4] dark:bg-transparent"
            />
            <select
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="h-8 rounded-md border border-g-border bg-white px-2.5 text-xs text-g-text outline-none focus:border-[#4285F4] dark:bg-transparent"
            >
              <option value="">メンバーを選択</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name ?? m.user.email}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddUserMapping}
              disabled={!newGithubLogin.trim() || !newUserId || addingMapping}
              className="text-xs"
            >
              {addingMapping ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              追加
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
