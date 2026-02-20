'use client';

import { useMemo } from 'react';
import { CheckCircle, Clock, AlertCircle, ListTodo } from 'lucide-react';
import { format, subDays, startOfDay, differenceInDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { StatCard } from './stat-card';
import { StatusChart } from './status-chart';
import { PriorityChart } from './priority-chart';
import { ActivityTrend } from './activity-trend';
import { SectionProgress } from './section-progress';
import { cn } from '@/lib/utils';
import type { Section } from '@/types';

const PRIORITY_STYLES: Record<string, { label: string; class: string }> = {
  P0: { label: '緊急', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  P1: { label: '高', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  P2: { label: '中', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  P3: { label: '低', class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

interface ProjectDashboardViewProps {
  sections: Section[];
  projectId: string;
}

export function ProjectDashboardView({ sections }: ProjectDashboardViewProps) {
  const stats = useMemo(() => {
    const allTasks = sections.flatMap((s) => s.tasks);
    const now = new Date();

    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.status === 'DONE').length;
    const inProgress = allTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const overdue = allTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    ).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // ステータス分布
    const statusMap = new Map<string, number>();
    for (const t of allTasks) {
      statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1);
    }
    const byStatus = Array.from(statusMap, ([status, count]) => ({ status, count }));

    // 優先度分布
    const priorityMap = new Map<string, number>();
    for (const t of allTasks) {
      priorityMap.set(t.priority, (priorityMap.get(t.priority) ?? 0) + 1);
    }
    const byPriority = Array.from(priorityMap, ([priority, count]) => ({ priority, count }));

    // セクション別進捗
    const sectionProgress = sections.map((s) => ({
      id: s.id,
      name: s.name,
      total: s.tasks.length,
      completed: s.tasks.filter((t) => t.status === 'DONE').length,
      color: s.color,
    }));

    // 14日間の完了トレンド
    const countByDate = new Map<string, number>();
    for (const t of allTasks) {
      if (!t.completedAt) continue;
      const key = format(new Date(t.completedAt), 'MM/dd');
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }
    const recentActivity = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(now, 13 - i);
      const key = format(date, 'MM/dd');
      return { date: key, count: countByDate.get(key) ?? 0 };
    });

    // 期限が迫るタスク（7日以内）
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = allTasks
      .filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) >= startOfDay(now) &&
          new Date(t.dueDate) <= sevenDaysLater &&
          t.status !== 'DONE'
      )
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 10);

    return {
      total,
      completed,
      inProgress,
      overdue,
      completionRate,
      byStatus,
      byPriority,
      sectionProgress,
      recentActivity,
      upcoming,
    };
  }, [sections]);

  return (
    <div className="flex-1 overflow-auto bg-g-surface p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* 統計カード */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="全タスク"
            value={stats.total}
            icon={ListTodo}
            iconColor="text-blue-600"
            iconBg="bg-blue-50 dark:bg-blue-900/30"
          />
          <StatCard
            title="完了タスク"
            value={stats.completed}
            subtitle={`完了率 ${stats.completionRate}%`}
            icon={CheckCircle}
            iconColor="text-green-600"
            iconBg="bg-green-50 dark:bg-green-900/30"
          />
          <StatCard
            title="進行中タスク"
            value={stats.inProgress}
            icon={Clock}
            iconColor="text-yellow-600"
            iconBg="bg-yellow-50 dark:bg-yellow-900/30"
          />
          <StatCard
            title="期限超過タスク"
            value={stats.overdue}
            icon={AlertCircle}
            iconColor="text-red-600"
            iconBg="bg-red-50 dark:bg-red-900/30"
          />
        </div>

        {/* チャート */}
        <div className="grid gap-6 lg:grid-cols-2">
          <StatusChart data={stats.byStatus} completionRate={stats.completionRate} />
          <PriorityChart data={stats.byPriority} />
        </div>

        {/* 完了トレンド */}
        <ActivityTrend data={stats.recentActivity} />

        {/* セクション別進捗 + 期限が迫るタスク */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionProgress data={stats.sectionProgress} />
          <div className="rounded-lg bg-g-bg p-5 shadow-sm ring-1 ring-g-border">
            <h2 className="mb-4 text-sm font-semibold text-g-text">期限が迫るタスク（7日以内）</h2>
            {stats.upcoming.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-g-text-muted">
                期限が迫るタスクはありません
              </div>
            ) : (
              <ul className="divide-y divide-g-surface-hover">
                {stats.upcoming.map((task) => {
                  const due = new Date(task.dueDate!);
                  const daysLeft = differenceInDays(due, new Date());
                  const priorityStyle = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.P3;
                  return (
                    <li key={task.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-g-text">{task.title}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn('rounded px-1.5 py-0.5 text-xs font-medium', priorityStyle.class)}
                        >
                          {priorityStyle.label}
                        </span>
                        <span
                          className={cn(
                            'text-xs whitespace-nowrap',
                            daysLeft === 0 ? 'font-semibold text-red-600' : 'text-g-text-secondary'
                          )}
                        >
                          {daysLeft === 0
                            ? '今日まで'
                            : `${format(due, 'M/d(E)', { locale: ja })}まで`}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
