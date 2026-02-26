'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Github,
  Loader2,
  Check,
  ChevronRight,
  Download,
  AlertCircle,
  ArrowLeft,
  ListChecks,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  color: string;
  sections: { id: string; name: string }[];
}

interface Repo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  openIssuesCount: number;
  mappedProjectId: string | null;
}

interface ChecklistItem {
  text: string;
  checked: boolean;
}

interface GitHubIssue {
  number: number;
  nodeId: string;
  title: string;
  body: string | null;
  state: string;
  labels: { name: string; color: string }[];
  createdAt: string;
  updatedAt: string;
  alreadyImported: boolean;
  tasukeTaskId: string | null;
  checklistItems: ChecklistItem[];
}

interface ImportGitHubClientProps {
  workspaceId: string;
  workspaceSlug: string;
  projects: Project[];
}

export function ImportGitHubClient({ workspaceId, workspaceSlug, projects }: ImportGitHubClientProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [projectId, setProjectId] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [importSubtasks, setImportSubtasks] = useState(true);
  const [importing, setImporting] = useState(false);
  const [fullSyncing, setFullSyncing] = useState(false);

  const fetchRepos = useCallback(async () => {
    setLoadingRepos(true);
    setGithubError(null);
    try {
      const res = await fetch('/api/github/repos');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || '';
        if (msg.includes('連携が設定されていません') || msg.includes('トークンが無効')) {
          setGithubError(msg);
          return;
        }
        throw new Error(msg || 'リポジトリ取得エラー');
      }
      const data = await res.json();
      setRepos(data.repos);
    } catch {
      toast({ title: 'リポジトリの取得に失敗しました', variant: 'destructive' });
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => { fetchRepos(); }, [fetchRepos]);

  const fetchIssues = useCallback(async (repo: Repo) => {
    setLoadingIssues(true);
    setIssues([]);
    setSelectedIssueIds(new Set());
    try {
      const res = await fetch(`/api/github/repos/${repo.owner}/${repo.name}/issues`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIssues(data.issues);
    } catch {
      toast({ title: 'Issueの取得に失敗しました', variant: 'destructive' });
    } finally {
      setLoadingIssues(false);
    }
  }, []);

  const handleSelectRepo = (repo: Repo) => {
    setSelectedRepo(repo);
    setSelectedIssueIds(new Set());
    fetchIssues(repo);
    if (repo.mappedProjectId) {
      setProjectId(repo.mappedProjectId);
    } else {
      setProjectId('');
    }
    setSectionId('');
  };

  const handleProjectChange = (v: string) => {
    setProjectId(v);
    setSectionId('');
  };

  const toggleIssue = (nodeId: string) => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleAll = () => {
    const importable = issues.filter((i) => !i.alreadyImported);
    if (selectedIssueIds.size === importable.length) {
      setSelectedIssueIds(new Set());
    } else {
      setSelectedIssueIds(new Set(importable.map((i) => i.nodeId)));
    }
  };

  const saveMapping = async (repoFullName: string, pId: string) => {
    try {
      await fetch('/api/github/mappings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubRepoFullName: repoFullName, projectId: pId, workspaceId }),
      });
    } catch {}
  };

  const handleImport = async () => {
    if (!projectId || selectedIssueIds.size === 0 || !selectedRepo) return;
    setImporting(true);
    try {
      const selectedIssues = issues
        .filter((i) => selectedIssueIds.has(i.nodeId))
        .map((i) => ({
          githubIssueId: i.number,
          githubIssueNodeId: i.nodeId,
          githubRepoFullName: selectedRepo.fullName,
          title: i.title,
          body: i.body,
          checklistItems: i.checklistItems,
        }));

      const res = await fetch('/api/github/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issues: selectedIssues,
          projectId,
          sectionId: sectionId || null,
          importSubtasks,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      const data = await res.json();
      toast({
        title: `${data.imported}件のIssueを取り込みました${data.skipped > 0 ? `（${data.skipped}件スキップ）` : ''}`,
      });

      saveMapping(selectedRepo.fullName, projectId);
      fetchIssues(selectedRepo);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : '取り込みに失敗しました',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleFullSync = async () => {
    if (!projectId || !selectedRepo) return;
    setFullSyncing(true);
    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepoFullName: selectedRepo.fullName,
          projectId,
          workspaceId,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast({
        title: `全件同期完了: ${data.created}件作成, ${data.updated}件更新（全${data.total}件）`,
      });
      fetchIssues(selectedRepo);
    } catch {
      toast({ title: '全件同期に失敗しました', variant: 'destructive' });
    } finally {
      setFullSyncing(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === projectId);
  const importableCount = issues.filter((i) => !i.alreadyImported).length;

  // GitHub未連携エラー
  if (githubError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
          <h3 className="mt-4 text-base font-semibold text-g-text">GitHub連携が必要です</h3>
          <p className="mt-2 text-sm text-g-text-muted">{githubError}</p>
          <Link
            href={`/${workspaceSlug}/settings/github`}
            className="mt-4 inline-block text-sm text-[#4285F4] hover:underline"
          >
            GitHub連携設定へ →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 左: リポジトリ一覧 */}
      <div className={cn(
        'flex w-full shrink-0 flex-col overflow-hidden border-r border-g-border bg-g-surface/50 md:w-72',
        selectedRepo ? 'hidden md:flex' : 'flex'
      )}>
        <div className="shrink-0 border-b border-g-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-g-text">
            <Github className="h-4 w-4" />
            リポジトリ
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loadingRepos ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-g-text-muted" />
            </div>
          ) : repos.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-g-text-muted">
              リポジトリが見つかりません
            </p>
          ) : (
            repos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => handleSelectRepo(repo)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                  selectedRepo?.id === repo.id
                    ? 'bg-[#4285F4]/10 text-[#4285F4]'
                    : 'text-g-text-secondary hover:bg-g-surface-hover'
                )}
              >
                <ChevronRight className={cn(
                  'h-3.5 w-3.5 shrink-0 transition-transform',
                  selectedRepo?.id === repo.id && 'rotate-90'
                )} />
                <span className="min-w-0 truncate">{repo.name}</span>
                {repo.isPrivate && <Lock className="ml-auto h-3 w-3 shrink-0 text-g-text-muted" />}
                {repo.mappedProjectId && (
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: projects.find((p) => p.id === repo.mappedProjectId)?.color }}
                  />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 右: Issue一覧 */}
      <div className={cn(
        'flex flex-1 flex-col overflow-hidden',
        !selectedRepo && 'hidden md:flex'
      )}>
        {!selectedRepo ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Github className="mx-auto h-12 w-12 text-g-text-muted/30" />
              <p className="mt-3 text-sm text-g-text-muted">
                左のリポジトリを選択してIssueを取り込んでください
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRepo(null)}
                    className="md:hidden text-g-text-secondary hover:text-g-text"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h3 className="text-sm font-medium text-g-text">
                    {selectedRepo.fullName}
                    <span className="ml-2 text-xs text-g-text-muted">
                      {importableCount}件取り込み可能
                    </span>
                  </h3>
                </div>
                {importableCount > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs text-[#4285F4] hover:underline"
                  >
                    {selectedIssueIds.size === importableCount ? 'すべて解除' : 'すべて選択'}
                  </button>
                )}
              </div>

              {loadingIssues ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-g-text-muted" />
                </div>
              ) : issues.length === 0 ? (
                <p className="py-12 text-center text-sm text-g-text-muted">
                  オープンなIssueはありません
                </p>
              ) : (
                <div className="space-y-1">
                  {issues.map((issue) => (
                    <div
                      key={issue.nodeId}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border border-g-border px-3 py-2.5',
                        issue.alreadyImported
                          ? 'bg-g-surface/50 opacity-50'
                          : selectedIssueIds.has(issue.nodeId)
                            ? 'border-[#4285F4]/30 bg-[#4285F4]/5'
                            : 'hover:bg-g-surface-hover'
                      )}
                    >
                      <Checkbox
                        checked={selectedIssueIds.has(issue.nodeId)}
                        onCheckedChange={() => toggleIssue(issue.nodeId)}
                        disabled={issue.alreadyImported}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-g-text-muted">#{issue.number}</span>
                          <span className={cn(
                            'text-sm',
                            issue.alreadyImported ? 'text-g-text-muted' : 'text-g-text'
                          )}>
                            {issue.title}
                          </span>
                          {issue.alreadyImported && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              <Check className="mr-0.5 h-2.5 w-2.5" />
                              取込済
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {issue.labels.map((l) => (
                            <span
                              key={l.name}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${l.color}20`,
                                color: l.color,
                                border: `1px solid ${l.color}40`,
                              }}
                            >
                              {l.name}
                            </span>
                          ))}
                          {issue.checklistItems.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-g-text-muted">
                              <ListChecks className="h-3 w-3" />
                              {issue.checklistItems.filter((c) => c.checked).length}/{issue.checklistItems.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 下部: 取り込みアクション */}
            <div className="border-t border-g-border bg-g-surface/50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-g-text-muted">プロジェクト:</span>
                  <Select value={projectId} onValueChange={handleProjectChange}>
                    <SelectTrigger className="h-8 w-40 text-xs sm:w-48">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            {p.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProject && selectedProject.sections.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-g-text-muted">セクション:</span>
                    <Select value={sectionId} onValueChange={setSectionId}>
                      <SelectTrigger className="h-8 w-32 text-xs sm:w-36">
                        <SelectValue placeholder="指定なし" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProject.sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <label className="flex items-center gap-1.5 text-xs text-g-text-secondary">
                  <Checkbox
                    checked={importSubtasks}
                    onCheckedChange={(v) => setImportSubtasks(!!v)}
                  />
                  サブタスク
                </label>

                <Button
                  onClick={handleFullSync}
                  disabled={!projectId || fullSyncing || importing}
                  variant="outline"
                  size="sm"
                  className="ml-auto gap-2"
                >
                  {fullSyncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  全件同期
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedIssueIds.size === 0 || !projectId || importing}
                  className="gap-2 bg-[#4285F4] text-white hover:bg-[#3367D6]"
                  size="sm"
                >
                  {importing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {selectedIssueIds.size}件を取り込む
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
