'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, FolderKanban, Calendar, AlertCircle } from 'lucide-react';
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

        {/* Project groups */}
        {projects.map((project) => {
          const projectTasks = tasksByProject.get(project.id) ?? [];
          if (projectTasks.length === 0) return null;
          const isCollapsed = collapsedProjects.has(project.id);

          return (
            <div key={project.id} className="rounded-lg border border-g-border bg-g-bg">
              <button
                onClick={() => toggleCollapse(project.id)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-g-border/50"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-g-text-muted" /> : <ChevronDown className="h-4 w-4 text-g-text-muted" />}
                <FolderKanban className="h-4 w-4" style={{ color: project.color }} />
                <span className="font-medium text-g-text">{project.name}</span>
                <span className="ml-auto text-xs text-g-text-muted">{projectTasks.length} タスク</span>
              </button>
              {!isCollapsed && (
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
