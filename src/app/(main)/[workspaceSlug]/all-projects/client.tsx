'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, FolderKanban, Calendar, AlertCircle, CheckCircle2, Clock, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';

interface TaskUser {
  id: string;
  name: string | null;
  image: string | null;
}

interface TaskData {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string;
  assignees: { id: string; user: TaskUser }[];
}

interface ProjectData {
  id: string;
  name: string;
  color: string;
}

interface AllProjectsClientProps {
  projects: ProjectData[];
  tasks: TaskData[];
  workspaceSlug: string;
}

const STATUS_LABELS: Record<string, string> = {
  TODO: '未着手',
  IN_PROGRESS: '進行中',
  DONE: '完了',
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-500',
  P1: 'bg-orange-500',
  P2: 'bg-yellow-500',
  P3: 'bg-gray-400',
};

const STATUS_FILTER_OPTIONS = ['ALL', 'TODO', 'IN_PROGRESS', 'DONE'] as const;
const PRIORITY_FILTER_OPTIONS = ['ALL', 'P0', 'P1', 'P2', 'P3'] as const;

interface ProjectStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  completionRate: number;
  priorityBreakdown: Record<string, number>;
}

function computeProjectStats(projectTasks: TaskData[]): ProjectStats {
  const total = projectTasks.length;
  const todo = projectTasks.filter(t => t.status === 'TODO').length;
  const inProgress = projectTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const done = projectTasks.filter(t => t.status === 'DONE').length;
  const overdue = projectTasks.filter(t =>
    t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)) && t.status !== 'DONE'
  ).length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const priorityBreakdown: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const t of projectTasks) {
    if (t.status !== 'DONE') priorityBreakdown[t.priority] = (priorityBreakdown[t.priority] || 0) + 1;
  }
  return { total, todo, inProgress, done, overdue, completionRate, priorityBreakdown };
}

function MiniDashboard({ stats, color }: { stats: ProjectStats; color: string }) {
  if (stats.total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-g-border/50 px-4 py-3">
      {/* Progress bar */}
      <div className="flex min-w-[180px] flex-1 items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-g-border">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${stats.completionRate}%`, backgroundColor: color }}
          />
        </div>
        <span className="shrink-0 text-xs font-semibold text-g-text">{stats.completionRate}%</span>
      </div>

      {/* Status counts */}
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-gray-500">
          <ListTodo className="h-3.5 w-3.5" />
          {stats.todo}
        </span>
        <span className="flex items-center gap-1 text-blue-500">
          <Clock className="h-3.5 w-3.5" />
          {stats.inProgress}
        </span>
        <span className="flex items-center gap-1 text-green-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {stats.done}
        </span>
        {stats.overdue > 0 && (
          <span className="flex items-center gap-1 font-medium text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
            {stats.overdue} 超過
          </span>
        )}
      </div>

      {/* Priority breakdown (only non-zero, active tasks) */}
      {(stats.priorityBreakdown.P0 > 0 || stats.priorityBreakdown.P1 > 0) && (
        <div className="flex items-center gap-2 text-xs">
          {stats.priorityBreakdown.P0 > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              P0: {stats.priorityBreakdown.P0}
            </span>
          )}
          {stats.priorityBreakdown.P1 > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              P1: {stats.priorityBreakdown.P1}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function AllProjectsClient({ projects, tasks, workspaceSlug }: AllProjectsClientProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const toggleCollapse = (projectId: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  };

  // Stats computed from ALL tasks (unfiltered)
  const statsByProject = useMemo(() => {
    const map = new Map<string, ProjectStats>();
    const grouped = new Map<string, TaskData[]>();
    for (const t of tasks) {
      const arr = grouped.get(t.projectId) ?? [];
      arr.push(t);
      grouped.set(t.projectId, arr);
    }
    for (const project of projects) {
      map.set(project.id, computeProjectStats(grouped.get(project.id) ?? []));
    }
    return map;
  }, [tasks, projects]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, TaskData[]>();
    for (const t of filteredTasks) {
      const arr = map.get(t.projectId) ?? [];
      arr.push(t);
      map.set(t.projectId, arr);
    }
    return map;
  }, [filteredTasks]);

  return (
    <div className="flex-1 overflow-auto bg-g-surface p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-g-text-muted">ステータス:</span>
            {STATUS_FILTER_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                  statusFilter === s
                    ? 'bg-g-text text-g-bg'
                    : 'bg-g-border text-g-text-secondary hover:bg-g-border/80',
                )}
              >
                {s === 'ALL' ? '全て' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-g-text-muted">優先度:</span>
            {PRIORITY_FILTER_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                  priorityFilter === p
                    ? 'bg-g-text text-g-bg'
                    : 'bg-g-border text-g-text-secondary hover:bg-g-border/80',
                )}
              >
                {p === 'ALL' ? '全て' : p}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-g-text-muted">
            {filteredTasks.length} タスク
          </span>
        </div>

        {/* Project cards with dashboard */}
        {projects.map((project) => {
          const stats = statsByProject.get(project.id);
          const projectTasks = tasksByProject.get(project.id) ?? [];
          const isCollapsed = collapsedProjects.has(project.id);

          if (!stats || stats.total === 0) return null;

          return (
            <div key={project.id} className="rounded-lg border border-g-border bg-g-bg">
              <button
                onClick={() => toggleCollapse(project.id)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-g-border/50"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-g-text-muted" /> : <ChevronDown className="h-4 w-4 text-g-text-muted" />}
                <FolderKanban className="h-4 w-4" style={{ color: project.color }} />
                <span className="font-medium text-g-text">{project.name}</span>
                <span className="ml-auto text-xs text-g-text-muted">
                  {stats.done}/{stats.total} 完了
                </span>
              </button>

              <MiniDashboard stats={stats} color={project.color} />

              {!isCollapsed && projectTasks.length > 0 && (
                <div className="border-t border-g-border">
                  {projectTasks.map((task) => {
                    const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && task.status !== 'DONE';
                    return (
                      <Link
                        key={task.id}
                        href={`/${workspaceSlug}/projects/${task.projectId}?task=${task.id}`}
                        className="flex items-center gap-3 border-b border-g-border/50 px-4 py-2.5 last:border-b-0 hover:bg-g-surface"
                      >
                        <div className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_COLORS[task.priority])} />
                        <span className={cn('flex-1 truncate text-sm', task.status === 'DONE' && 'text-g-text-muted line-through')}>
                          {task.title}
                        </span>
                        <span className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                          task.status === 'TODO' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                          task.status === 'IN_PROGRESS' && 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                          task.status === 'DONE' && 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
                        )}>
                          {STATUS_LABELS[task.status]}
                        </span>
                        {task.dueDate && (
                          <span className={cn('flex shrink-0 items-center gap-1 text-xs', isOverdue ? 'text-red-500' : 'text-g-text-muted')}>
                            {isOverdue && <AlertCircle className="h-3 w-3" />}
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.dueDate), 'M/d', { locale: ja })}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}

              {!isCollapsed && projectTasks.length === 0 && (
                <div className="border-t border-g-border px-4 py-3 text-center text-xs text-g-text-muted">
                  フィルタ条件に一致するタスクなし
                </div>
              )}
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="rounded-lg border border-g-border bg-g-bg p-8 text-center text-g-text-muted">
            条件に一致するタスクがありません
          </div>
        )}
      </div>
    </div>
  );
}
