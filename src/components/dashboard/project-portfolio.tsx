'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ListTodo,
  ArrowRight,
} from 'lucide-react';

export interface PortfolioProject {
  id: string;
  name: string;
  color: string;
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  overdue: number;
  dueThisWeek: number;
  nextDeadline: { title: string; date: string } | null;
}

function getHealth(p: PortfolioProject) {
  if (p.total === 0)
    return { label: '—', dot: 'bg-gray-300', text: 'text-g-text-muted' };
  if (p.overdue >= 3 || (p.total >= 5 && p.overdue / p.total >= 0.2))
    return { label: '要対応', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
  if (p.overdue > 0)
    return { label: '注意', dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' };
  return { label: '順調', dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' };
}

interface ProjectPortfolioProps {
  data: PortfolioProject[];
  workspaceSlug: string;
}

export function ProjectPortfolio({ data, workspaceSlug }: ProjectPortfolioProps) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-lg bg-g-bg p-5 shadow-sm ring-1 ring-g-border">
      <h2 className="mb-4 text-sm font-semibold text-g-text">プロジェクト</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((project) => {
          const rate =
            project.total > 0
              ? Math.round((project.completed / project.total) * 100)
              : 0;
          const health = getHealth(project);

          return (
            <Link
              key={project.id}
              href={`/${workspaceSlug}/projects/${project.id}`}
              className="group relative flex flex-col rounded-lg border border-g-border p-4 transition-all hover:border-g-text/20 hover:shadow-md"
            >
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate text-sm font-semibold text-g-text">
                    {project.name}
                  </span>
                </div>
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium',
                    health.text,
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', health.dot)} />
                  {health.label}
                </span>
              </div>

              {/* Progress */}
              <div className="mb-3 flex items-center gap-2.5">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-g-surface-hover">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${rate}%`,
                      backgroundColor: project.color,
                    }}
                  />
                </div>
                <span className="shrink-0 text-xs font-bold text-g-text">
                  {rate}%
                </span>
              </div>

              {/* Status counts */}
              <div className="mb-3 flex items-center gap-3 text-xs text-g-text-secondary">
                <span className="flex items-center gap-1">
                  <ListTodo className="h-3 w-3 text-gray-400" />
                  {project.todo}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-blue-400" />
                  {project.inProgress}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-400" />
                  {project.completed}
                </span>
                <span className="ml-auto text-g-text-muted">
                  {project.total} タスク
                </span>
              </div>

              {/* Bottom: overdue, due this week, next deadline */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-g-border/50 pt-2.5 text-xs">
                {project.overdue > 0 && (
                  <span className="flex items-center gap-1 font-medium text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {project.overdue} 超過
                  </span>
                )}
                {project.dueThisWeek > 0 && (
                  <span className="flex items-center gap-1 text-g-text-secondary">
                    <Calendar className="h-3 w-3" />
                    今週 {project.dueThisWeek}
                  </span>
                )}
                {project.nextDeadline && (
                  <span className="ml-auto truncate text-g-text-muted">
                    次:{' '}
                    {format(new Date(project.nextDeadline.date), 'M/d', {
                      locale: ja,
                    })}
                  </span>
                )}
                {!project.overdue &&
                  !project.dueThisWeek &&
                  !project.nextDeadline && (
                    <span className="text-g-text-muted">予定なし</span>
                  )}
              </div>

              {/* Hover arrow */}
              <ArrowRight className="absolute right-3 top-4 h-4 w-4 text-g-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
