'use client';

import { useState, useEffect, useCallback } from 'react';
import { Github, Loader2, ExternalLink, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface GitHubSettingsClientProps {
  workspaceSlug: string;
}

interface Integration {
  githubUsername: string;
  createdAt: string;
  updatedAt: string;
}

export function GitHubSettingsClient({ workspaceSlug }: GitHubSettingsClientProps) {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [pat, setPat] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchIntegration = useCallback(async () => {
    try {
      const res = await fetch('/api/github/integration');
      if (res.ok) {
        const data = await res.json();
        setIntegration(data.integration);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntegration(); }, [fetchIntegration]);

  const handleSave = async () => {
    if (!pat.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/github/integration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pat }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error, variant: 'destructive' });
        return;
      }
      setIntegration({ githubUsername: data.githubUsername, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      setPat('');
      toast({ title: `GitHub連携完了: @${data.githubUsername}` });
    } catch {
      toast({ title: '連携に失敗しました', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch('/api/github/integration', { method: 'DELETE' });
      setIntegration(null);
      toast({ title: 'GitHub連携を解除しました' });
    } catch {
      toast({ title: '解除に失敗しました', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-g-text-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-lg border border-g-border bg-g-surface p-6">
        <div className="flex items-center gap-3 mb-6">
          <Github className="h-6 w-6 text-g-text" />
          <div>
            <h2 className="text-base font-semibold text-g-text">GitHub連携</h2>
            <p className="text-xs text-g-text-muted">
              Personal Access Tokenを設定してGitHub Issuesを取り込めるようにします
            </p>
          </div>
        </div>

        {integration ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md bg-green-500/10 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-g-text">連携中: @{integration.githubUsername}</p>
                <p className="text-xs text-g-text-muted">
                  {new Date(integration.updatedAt).toLocaleDateString('ja-JP')} に設定
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-g-text">Personal Access Token</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <Button
                  onClick={handleSave}
                  disabled={!pat.trim() || saving}
                  className="bg-[#4285F4] text-white hover:bg-[#3367D6]"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '連携する'}
                </Button>
              </div>
            </div>

            <div className="rounded-md bg-g-bg px-4 py-3 text-xs text-g-text-muted space-y-2">
              <p className="font-medium text-g-text-secondary">トークンの作成方法:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  <a
                    href="https://github.com/settings/tokens/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#4285F4] hover:underline inline-flex items-center gap-1"
                  >
                    GitHub Token設定 <ExternalLink className="h-3 w-3" />
                  </a>
                  を開く
                </li>
                <li>「repo」スコープにチェック</li>
                <li>トークンを生成してコピー</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
