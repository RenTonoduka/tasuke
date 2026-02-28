'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Flag, FolderKanban, List, CalendarClock, ArrowUpDown } from 'lucide-react';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { useSubtaskExpand } from '@/hooks/use-subtask-expand';
import { SubtaskToggle, SubtaskList } from '@/components/task/subtask-inline';
import { TaskDetailPanel } from '@/components/task/task-detail-panel';
import { ScheduleView } from '@/components/schedule/schedule-view';
import { cn } from '@/lib/utils';
import { eventBus, EVENTS } from '@/lib/event-bus';

const priorityConfig: Record<string, { label: string; color: string }> = {
  P0: { label: 'P0', color: '#EA4335' },
  P1: { label: 'P1', color: '#FBBC04' },
  P2: { label: 'P2', color: '#4285F4' },
  P3: { label: 'P3', color: '#80868B' },
};

interface MyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  project: { id: string; name: string; color: string };
  assignees: { id: string; user: { id: string; name: string | null; image: string | null } }[];
  labels: { id: string; label: { id: string; name: string; color: string } }[];
  _count: { subtasks: number };
}

interface MyTasksClientProps {
  tasks: MyTask[];
  workspaceSlug: string;
}

type ViewType = 'list' | 'schedule';
type SortKey = 'priority' | 'dueDate' | 'project' | 'title';

const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function sortTasks(tasks: MyTask[], key: SortKey): MyTask[] {
  return [...tasks].sort((a, b) => {
    switch (key) {
      case 'priority':
        return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      case 'dueDate': {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      case 'project':
        return a.project.name.localeCompare(b.project.name, 'ja');
      case 'title':
        return a.title.localeCompare(b.title, 'ja');
      default:
        return 0;
    }
  });
}

const sortLabels: Record<SortKey, string> = {
  priority: '優先度',
  dueDate: '期限',
  project: 'プロジェクト',
  title: 'タイトル',
};

export function MyTasksClient({ tasks: initialTasks, workspaceSlug }: MyTasksClientProps) {
  const [tasks, setTasks] = useState(initialTasks);
  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);
  const [view, setView] = useState<ViewType>('list');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const openPanel = useTaskPanelStore((s) => s.open);
  const activeTaskId = useTaskPanelStore((s) => s.activeTaskId);
  const { expanded, subtasks, loading, toggle: toggleSubtask, toggleStatus, deleteSubtask } = useSubtaskExpand();

  // タスク更新イベントで該当タスクをリフレッシュ
  const refreshTask = useCallback(async (taskId: unknown) => {
    if (typeof taskId !== 'string') return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) =>
          prev.map((t) => t.id === taskId ? {
            ...t,
            title: updated.title,
            status: updated.status,
            priority: updated.priority,
            dueDate: updated.dueDate,
            assignees: updated.assignees,
            labels: updated.labels,
            project: updated.project,
          } : t)
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    const unsub = eventBus.on(EVENTS.TASK_UPDATED, refreshTask);
    return unsub;
  }, [refreshTask]);

  const handleToggle = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error('ステータス更新エラー:', err);
    }
  };

  const sorted = sortTasks(tasks, sortKey);
  const pending = sorted.filter((t) => t.status !== 'DONE');
  const done = sorted.filter((t) => t.status === 'DONE');

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ビュー切替タブ + ソート */}
      <div className="flex items-center gap-1 border-b border-g-border bg-g-bg px-4 py-1.5">
        <button
          onClick={() => setView('list')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            view === 'list'
              ? 'bg-g-border text-g-text'
              : 'text-g-text-secondary hover:bg-g-surface-hover'
          )}
        >
          <List className="h-3.5 w-3.5" />
          リスト
        </button>
        <button
          onClick={() => setView('schedule')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            view === 'schedule'
              ? 'bg-g-border text-g-text'
              : 'text-g-text-secondary hover:bg-g-surface-hover'
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          スケジュール
        </button>

        {view === 'list' && (
          <div className="ml-auto flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3 text-g-text-muted" />
            {(Object.keys(sortLabels) as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] transition-colors',
                  sortKey === key
                    ? 'bg-[#4285F4]/10 font-medium text-[#4285F4]'
                    : 'text-g-text-muted hover:bg-g-surface-hover hover:text-g-text-secondary'
                )}
              >
                {sortLabels[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* リストビュー */}
      {view === 'list' && (
        <div className="flex-1 overflow-auto">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-g-text-secondary">担当タスクがありません</p>
              <p className="mt-1 text-sm text-g-text-muted">
                プロジェクト内でタスクをアサインすると表示されます
              </p>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 bg-g-surface px-4 py-2">
                    <span className="text-sm font-semibold text-g-text">未完了</span>
                    <span className="rounded-full bg-g-border px-2 py-0.5 text-xs text-g-text-secondary">
                      {pending.length}
                    </span>
                  </div>
                  {pending.map((task) => (
                    <div key={task.id}>
                      <TaskRow
                        task={task}
                        workspaceSlug={workspaceSlug}
                        onOpen={() => openPanel(task.id)}
                        onToggle={() => handleToggle(task.id, task.status)}
                        subtaskExpanded={!!expanded[task.id]}
                        subtaskDoneCount={(subtasks[task.id] ?? []).filter((s) => s.status === 'DONE').length}
                        onToggleSubtask={() => toggleSubtask(task.id)}
                      />
                      {expanded[task.id] && (
                        <SubtaskList
                          subtasks={subtasks[task.id] ?? []}
                          loading={loading[task.id]}
                          parentId={task.id}
                          onToggleStatus={toggleStatus}
                          onDelete={deleteSubtask}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {done.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 bg-g-surface px-4 py-2 border-t border-g-border">
                    <span className="text-sm font-semibold text-g-text">完了</span>
                    <span className="rounded-full bg-g-border px-2 py-0.5 text-xs text-g-text-secondary">
                      {done.length}
                    </span>
                  </div>
                  {done.map((task) => (
                    <div key={task.id}>
                      <TaskRow
                        task={task}
                        workspaceSlug={workspaceSlug}
                        onOpen={() => openPanel(task.id)}
                        onToggle={() => handleToggle(task.id, task.status)}
                        subtaskExpanded={!!expanded[task.id]}
                        subtaskDoneCount={(subtasks[task.id] ?? []).filter((s) => s.status === 'DONE').length}
                        onToggleSubtask={() => toggleSubtask(task.id)}
                      />
                      {expanded[task.id] && (
                        <SubtaskList
                          subtasks={subtasks[task.id] ?? []}
                          loading={loading[task.id]}
                          parentId={task.id}
                          onToggleStatus={toggleStatus}
                          onDelete={deleteSubtask}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* スケジュールビュー */}
      {view === 'schedule' && (
        <ScheduleView myTasksOnly />
      )}

      <TaskDetailPanel />
    </div>
  );
}

function TaskRow({
  task,
  workspaceSlug,
  onOpen,
  onToggle,
  subtaskExpanded,
  subtaskDoneCount,
  onToggleSubtask,
}: {
  task: MyTask;
  workspaceSlug: string;
  onOpen: () => void;
  onToggle: () => void;
  subtaskExpanded: boolean;
  subtaskDoneCount: number;
  onToggleSubtask: () => void;
}) {
  const p = priorityConfig[task.priority] ?? priorityConfig.P3;

  return (
    <div
      className="flex items-center gap-3 border-b border-g-surface-hover px-4 py-2 hover:bg-g-surface cursor-pointer"
      onClick={onOpen}
    >
      <Checkbox
        checked={task.status === 'DONE'}
        onCheckedChange={() => onToggle()}
        onClick={(e) => e.stopPropagation()}
      />

      {task._count.subtasks > 0 && (
        <SubtaskToggle
          count={task._count.subtasks}
          doneCount={subtaskDoneCount}
          expanded={subtaskExpanded}
          onToggle={onToggleSubtask}
        />
      )}

      <span
        className={cn(
          'flex-1 truncate text-sm text-g-text',
          task.status === 'DONE' && 'line-through text-g-text-muted'
        )}
      >
        {task.title}
      </span>

      {/* Project name */}
      <a
        href={`/${workspaceSlug}/projects/${task.project.id}`}
        className="hidden items-center gap-1 text-xs text-g-text-secondary hover:text-g-text sm:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <FolderKanban className="h-3 w-3" style={{ color: task.project.color }} />
        {task.project.name}
      </a>

      <div className="hidden items-center gap-1 sm:flex">
        <Flag className="h-3 w-3" style={{ color: p.color }} />
        <span className="text-xs text-g-text-secondary">{p.label}</span>
      </div>

      <div className="hidden gap-1 lg:flex">
        {task.labels.slice(0, 2).map((tl) => (
          <Badge
            key={tl.id}
            variant="secondary"
            className="h-5 text-[10px]"
            style={{ backgroundColor: tl.label.color + '20', color: tl.label.color }}
          >
            {tl.label.name}
          </Badge>
        ))}
      </div>

      {task.dueDate && (
        <span className="hidden items-center gap-1 text-xs text-g-text-secondary sm:flex">
          <Calendar className="h-3 w-3" />
          {new Date(task.dueDate).toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )}
    </div>
  );
}
