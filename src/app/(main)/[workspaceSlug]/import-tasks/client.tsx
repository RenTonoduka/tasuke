'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, ListTodo, Check, Loader2, Calendar, ChevronRight, AlertCircle, ArrowLeft } from 'lucide-react';
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

interface TaskList {
  id: string;
  title: string;
  updated: string;
  mappedProjectId: string | null;
}

interface GoogleTask {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  due: string | null;
  updated: string;
  alreadyImported: boolean;
  tasukeTaskId: string | null;
}

interface ImportTasksClientProps {
  workspaceId: string;
  workspaceSlug: string;
  projects: Project[];
}

export function ImportTasksClient({ workspaceId, projects }: ImportTasksClientProps) {
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [projectId, setProjectId] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [importing, setImporting] = useState(false);

  // タスクリスト一覧を取得
  const fetchLists = useCallback(async () => {
    setLoadingLists(true);
    setGoogleError(null);
    try {
      const res = await fetch('/api/google-tasks/lists');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || '';
        if (msg.includes('連携されていません') || msg.includes('再認証')) {
          setGoogleError(msg);
          return;
        }
        throw new Error(msg || 'リスト取得エラー');
      }
      const data = await res.json();
      setTaskLists(data.lists);
    } catch {
      toast({ title: 'Google Tasksの取得に失敗しました', variant: 'destructive' });
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  // リスト選択時にタスクを取得
  const fetchTasks = useCallback(async (listId: string) => {
    setLoadingTasks(true);
    setTasks([]);
    setSelectedTaskIds(new Set());
    try {
      const res = await fetch(`/api/google-tasks/lists/${listId}/tasks`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTasks(data.tasks);
    } catch {
      toast({ title: 'タスクの取得に失敗しました', variant: 'destructive' });
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const handleSelectList = (listId: string) => {
    setSelectedListId(listId);
    setSelectedTaskIds(new Set());
    fetchTasks(listId);
    // マッピング済みならプロジェクト自動選択、なければリセット
    const list = taskLists.find((l) => l.id === listId);
    if (list?.mappedProjectId) {
      setProjectId(list.mappedProjectId);
    } else {
      setProjectId('');
    }
    setSectionId('');
  };

  // プロジェクト変更時にセクションリセット
  const handleProjectChange = (v: string) => {
    setProjectId(v);
    setSectionId('');
  };

  // タスク選択トグル
  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // 全選択/全解除
  const toggleAll = () => {
    const importable = tasks.filter((t) => !t.alreadyImported);
    if (selectedTaskIds.size === importable.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(importable.map((t) => t.id)));
    }
  };

  // マッピング保存
  const saveMapping = async (listId: string, pId: string) => {
    const list = taskLists.find((l) => l.id === listId);
    if (!list) return;
    try {
      await fetch('/api/google-tasks/mappings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleTaskListId: listId,
          googleTaskListName: list.title,
          projectId: pId,
          workspaceId,
        }),
      });
    } catch {}
  };

  // 取り込み実行
  const handleImport = async () => {
    if (!projectId || selectedTaskIds.size === 0) return;
    setImporting(true);
    try {
      const selectedTasks = tasks
        .filter((t) => selectedTaskIds.has(t.id))
        .map((t) => ({
          googleTaskId: t.id,
          googleTaskListId: selectedListId!,
          title: t.title,
          description: t.notes,
          dueDate: t.due,
        }));

      const res = await fetch('/api/google-tasks/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: selectedTasks,
          projectId,
          sectionId: sectionId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      const data = await res.json();
      toast({
        title: `${data.imported}件のタスクを取り込みました${data.skipped > 0 ? `（${data.skipped}件スキップ）` : ''}`,
      });

      // マッピング保存
      if (selectedListId) saveMapping(selectedListId, projectId);

      // リスト再取得
      fetchTasks(selectedListId!);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : '取り込みに失敗しました',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === projectId);
  const importableCount = tasks.filter((t) => !t.alreadyImported).length;

  // Google未連携エラー
  if (googleError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
          <h3 className="mt-4 text-base font-semibold text-g-text">Googleアカウントの連携が必要です</h3>
          <p className="mt-2 text-sm text-g-text-muted">
            {googleError}
          </p>
          <p className="mt-4 text-xs text-g-text-muted">
            一度ログアウトしてから再度Googleアカウントでログインしてください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 左: タスクリスト一覧（モバイルではリスト未選択時のみ表示） */}
      <div className={cn(
        'w-full shrink-0 border-r border-g-border bg-g-surface/50 md:w-72',
        selectedListId ? 'hidden md:block' : 'block'
      )}>
        <div className="border-b border-g-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-g-text">
            <ListTodo className="h-4 w-4" />
            Google Tasks リスト
          </h2>
        </div>
        <div className="overflow-y-auto p-2">
          {loadingLists ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-g-text-muted" />
            </div>
          ) : taskLists.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-g-text-muted">
              タスクリストが見つかりません
            </p>
          ) : (
            taskLists.map((list) => (
              <button
                key={list.id}
                onClick={() => handleSelectList(list.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                  selectedListId === list.id
                    ? 'bg-[#4285F4]/10 text-[#4285F4]'
                    : 'text-g-text-secondary hover:bg-g-surface-hover'
                )}
              >
                <ChevronRight className={cn(
                  'h-3.5 w-3.5 shrink-0 transition-transform',
                  selectedListId === list.id && 'rotate-90'
                )} />
                <span className="truncate">{list.title}</span>
                {list.mappedProjectId && (
                  <div
                    className="ml-auto h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: projects.find((p) => p.id === list.mappedProjectId)?.color }}
                  />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 右: タスク一覧 + 取り込みアクション */}
      <div className={cn(
        'flex flex-1 flex-col overflow-hidden',
        !selectedListId && 'hidden md:flex'
      )}>
        {!selectedListId ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Download className="mx-auto h-12 w-12 text-g-text-muted/30" />
              <p className="mt-3 text-sm text-g-text-muted">
                左のリストを選択して取り込むタスクを選んでください
              </p>
              <p className="mt-1 text-xs text-g-text-muted/70">
                Google Meet議事録やGoogle Chatで作成されたタスクが表示されます
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* タスクリスト */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* モバイル戻るボタン */}
                  <button
                    onClick={() => setSelectedListId(null)}
                    className="md:hidden text-g-text-secondary hover:text-g-text"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h3 className="text-sm font-medium text-g-text">
                    {taskLists.find((l) => l.id === selectedListId)?.title}
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
                    {selectedTaskIds.size === importableCount ? 'すべて解除' : 'すべて選択'}
                  </button>
                )}
              </div>

              {loadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-g-text-muted" />
                </div>
              ) : tasks.length === 0 ? (
                <p className="py-12 text-center text-sm text-g-text-muted">
                  未完了のタスクはありません
                </p>
              ) : (
                <div className="space-y-1">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border border-g-border px-3 py-2.5',
                        task.alreadyImported
                          ? 'bg-g-surface/50 opacity-50'
                          : selectedTaskIds.has(task.id)
                            ? 'border-[#4285F4]/30 bg-[#4285F4]/5'
                            : 'hover:bg-g-surface-hover'
                      )}
                    >
                      <Checkbox
                        checked={selectedTaskIds.has(task.id)}
                        onCheckedChange={() => toggleTask(task.id)}
                        disabled={task.alreadyImported}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-sm',
                            task.alreadyImported ? 'text-g-text-muted' : 'text-g-text'
                          )}>
                            {task.title}
                          </span>
                          {task.alreadyImported && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              <Check className="mr-0.5 h-2.5 w-2.5" />
                              取込済
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-g-text-muted">
                          {task.due && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.due).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {task.notes && (
                            <span className="truncate">{task.notes.slice(0, 60)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 下部: 取り込みアクション（レスポンシブ対応） */}
            <div className="border-t border-g-border bg-g-surface/50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-g-text-muted">プロジェクト:</span>
                  <Select
                    value={projectId}
                    onValueChange={handleProjectChange}
                  >
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

                <Button
                  onClick={handleImport}
                  disabled={selectedTaskIds.size === 0 || !projectId || importing}
                  className="ml-auto gap-2 bg-[#4285F4] text-white hover:bg-[#3367D6]"
                  size="sm"
                >
                  {importing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {selectedTaskIds.size}件を取り込む
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
