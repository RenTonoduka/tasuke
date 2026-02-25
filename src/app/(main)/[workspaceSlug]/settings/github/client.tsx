'use client';

import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { Github, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface GitHubSettingsClientProps {
  workspaceSlug: string;
}

export function GitHubSettingsClient({ workspaceSlug }: GitHubSettingsClientProps) {
  const [connected, setConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

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
              GitHubアカウントを連携してIssueを取り込めるようにします
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
    </div>
  );
}
