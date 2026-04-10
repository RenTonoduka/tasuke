'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Flag, FolderKanban, List, CalendarClock, ArrowUpDown, Sun, AlertCircle, CalendarDays, Clock, Inbox } from 'lucide-react';
import { startOfDay, endOfDay, addDays, endOfWeek, isAfter, isBefore, isSameDay, format } from 'date-fns';
import { ja } from 'date-fns/locale';
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

type ViewType = 'today' | 'list' | 'schedule';
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
  const [view, setView] = useState<ViewType>('today');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const openPanel = useTaskPanelStore((s) => s.open);
  const activeTaskId = useTaskPanelStore((s) => s.activeTaskId);
  const { expanded, subtasks, loading, toggle: toggleSubtask, toggleStatus, deleteSubtask } = useSubtaskExpand();

  // タスク更新イベントで該当タスクをリフレッシュ
  const refreshTask = useCallback(async (taskId: unknown) => {
    if (typeof taskId !== 'string') return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) return;
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
    } catch {
      // ネットワークエラー時はリフレッシュをスキップ
    }
  }, []);

  // タスク削除イベントでリストから除去
  const removeTask = useCallback((taskId: unknown) => {
    if (typeof taskId !== 'string') return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  useEffect(() => {
    const unsub1 = eventBus.on(EVENTS.TASK_UPDATED, refreshTask);
    const unsub2 = eventBus.on(EVENTS.TASK_DELETED, removeTask);
    return () => { unsub1(); unsub2(); };
  }, [refreshTask, removeTask]);

  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const handleToggle = useCallback(async (taskId: string, currentStatus: string) => {
    if (togglingIds.has(taskId)) return;
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
    // 楽観的更新
    setTogglingIds((prev) => new Set(prev).add(taskId));
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // エラー時はロールバック
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: currentStatus } : t)));
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  }, [togglingIds]);

  const sorted = useMemo(() => sortTasks(tasks, sortKey), [tasks, sortKey]);
  const pending = useMemo(() => sorted.filter((t) => t.status !== 'DONE'), [sorted]);
  const done = useMemo(() => sorted.filter((t) => t.status === 'DONE'), [sorted]);

  // Today ビュー用のセクション分け
  const todaySections = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const dayAfterTomorrow = addDays(today, 2);
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 }); // 日曜日まで

    const activeTasks = tasks.filter(t => t.status !== 'DONE');
    const byPriority = [...activeTasks].sort((a, b) =>
      (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
    );

    const overdue: MyTask[] = [];
    const todayTasks: MyTask[] = [];
    const tomorrowTasks: MyTask[] = [];
    const thisWeekTasks: MyTask[] = [];
    const laterTasks: MyTask[] = [];
    const noDueDateTasks: MyTask[] = [];

    for (const task of byPriority) {
      if (!task.dueDate) {
        noDueDateTasks.push(task);
        continue;
      }
      const due = startOfDay(new Date(task.dueDate));
      if (isBefore(due, today)) {
        overdue.push(task);
      } else if (isSameDay(due, today)) {
        todayTasks.push(task);
      } else if (isSameDay(due, tomorrow)) {
        tomorrowTasks.push(task);
      } else if (!isAfter(due, weekEnd)) {
        thisWeekTasks.push(task);
      } else {
        laterTasks.push(task);
      }
    }

    // overdue は期限が近い順にソート
    overdue.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    const weekLabel = `${format(dayAfterTomorrow, 'M/d')}〜${format(weekEnd, 'M/d')}`;

    return { overdue, todayTasks, tomorrowTasks, thisWeekTasks, laterTasks, noDueDateTasks, weekLabel };
  }, [tasks]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ビュー切替タブ + ソート */}
      <div className="flex items-center gap-0.5 border-b border-g-border bg-g-bg px-3 py-1">
        {([
          { key: 'today' as ViewType, label: 'Today', Icon: Sun },
          { key: 'list' as ViewType, label: 'リスト', Icon: List },
          { key: 'schedule' as ViewType, label: 'スケジュール', Icon: CalendarClock },
        ]).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
              view === key
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover',
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}

        {view === 'list' && (
          <div className="ml-auto flex items-center gap-0.5">
            <ArrowUpDown className="h-3 w-3 text-g-text-muted" />
            {(Object.keys(sortLabels) as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[11px] transition-colors',
                  sortKey === key
                    ? 'bg-[#4285F4]/10 font-medium text-[#4285F4]'
                    : 'text-g-text-muted hover:bg-g-surface-hover hover:text-g-text-secondary',
                )}
              >
                {sortLabels[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Today ビュー */}
      {view === 'today' && (
        <div className="flex-1 overflow-auto">
          {tasks.filter(t => t.status !== 'DONE').length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Sun className="h-10 w-10 text-yellow-400 mb-3" />
              <p className="text-g-text-secondary font-medium">今日のタスクはありません</p>
              <p className="mt-1 text-sm text-g-text-muted">すべてのタスクが完了しています</p>
            </div>
          ) : (
            <>
              <TodaySection
                icon={AlertCircle}
                iconColor="text-red-500"
                bgColor="bg-red-500/5"
                label="期限超過"
                count={todaySections.overdue.length}
                tasks={todaySections.overdue}
                workspaceSlug={workspaceSlug}
                openPanel={openPanel}
                onToggle={handleToggle}
                expanded={expanded}
                subtasks={subtasks}
                loading={loading}
                toggleSubtask={toggleSubtask}
                toggleStatus={toggleStatus}
                deleteSubtask={deleteSubtask}
              />
              <TodaySection
                icon={Sun}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/5"
                label="今日"
                count={todaySections.todayTasks.length}
                tasks={todaySections.todayTasks}
                workspaceSlug={workspaceSlug}
                openPanel={openPanel}
                onToggle={handleToggle}
                expanded={expanded}
                subtasks={subtasks}
                loading={loading}
                toggleSubtask={toggleSubtask}
                toggleStatus={toggleStatus}
                deleteSubtask={deleteSubtask}
              />
              <TodaySection
                icon={CalendarDays}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/5"
                label="明日"
                count={todaySections.tomorrowTasks.length}
                tasks={todaySections.tomorrowTasks}
                workspaceSlug={workspaceSlug}
                openPanel={openPanel}
                onToggle={handleToggle}
                expanded={expanded}
                subtasks={subtasks}
                loading={loading}
                toggleSubtask={toggleSubtask}
                toggleStatus={toggleStatus}
                deleteSubtask={deleteSubtask}
              />
              <TodaySection
                icon={Calendar}
                iconColor="text-indigo-500"
                bgColor="bg-indigo-500/5"
                label={`今週 (${todaySections.weekLabel})`}
                count={todaySections.thisWeekTasks.length}
                tasks={todaySections.thisWeekTasks}
                workspaceSlug={workspaceSlug}
                openPanel={openPanel}
                onToggle={handleToggle}
                expanded={expanded}
                subtasks={subtasks}
                loading={loading}
                toggleSubtask={toggleSubtask}
                toggleStatus={toggleStatus}
                deleteSubtask={deleteSubtask}
              />
              <TodaySection
                icon={Clock}
                iconColor="text-gray-400"
                bgColor="bg-gray-500/5"
                label="来週以降"
                count={todaySections.laterTasks.length}
                tasks={todaySections.laterTasks}
                workspaceSlug={workspaceSlug}
                openPanel={openPanel}
                onToggle={handleToggle}
                expanded={expanded}
                subtasks={subtasks}
                loading={loading}
                toggleSubtask={toggleSubtask}
                toggleStatus={toggleStatus}
                deleteSubtask={deleteSubtask}
                defaultCollapsed
              />
              <TodaySection
                icon={Inbox}
                iconColor="text-gray-400"
                bgColor="bg-gray-500/5"
                label="期限なし"
                count={todaySections.noDueDateTasks.length}
                tasks={todaySections.noDueDateTasks}
                workspaceSlug={workspaceSlug}
                openPanel={openPanel}
                onToggle={handleToggle}
                expanded={expanded}
                subtasks={subtasks}
                loading={loading}
                toggleSubtask={toggleSubtask}
                toggleStatus={toggleStatus}
                deleteSubtask={deleteSubtask}
                defaultCollapsed
              />
            </>
          )}
        </div>
      )}

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

function TodaySection({
  icon: Icon,
  iconColor,
  bgColor,
  label,
  count,
  tasks,
  workspaceSlug,
  openPanel,
  onToggle,
  expanded,
  subtasks,
  loading,
  toggleSubtask,
  toggleStatus,
  deleteSubtask,
  defaultCollapsed = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  label: string;
  count: number;
  tasks: MyTask[];
  workspaceSlug: string;
  openPanel: (id: string) => void;
  onToggle: (id: string, status: string) => void;
  expanded: Record<string, boolean>;
  subtasks: Record<string, { id: string; title: string; status: string }[]>;
  loading: Record<string, boolean>;
  toggleSubtask: (id: string) => void;
  toggleStatus: (parentId: string, subtaskId: string, currentStatus: string) => void;
  deleteSubtask: (parentId: string, subtaskId: string) => Promise<void>;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (count === 0) return null;

  return (
    <div>
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className={cn('flex w-full items-center gap-2 px-4 py-2.5 text-left', bgColor)}
      >
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-sm font-semibold text-g-text">{label}</span>
        <span className="rounded-full bg-g-border px-2 py-0.5 text-xs text-g-text-secondary">
          {count}
        </span>
        <svg
          className={cn('ml-auto h-3.5 w-3.5 text-g-text-muted transition-transform', !collapsed && 'rotate-90')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {!collapsed && tasks.map((task) => (
        <div key={task.id}>
          <TaskRow
            task={task}
            workspaceSlug={workspaceSlug}
            onOpen={() => openPanel(task.id)}
            onToggle={() => onToggle(task.id, task.status)}
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
  );
}
