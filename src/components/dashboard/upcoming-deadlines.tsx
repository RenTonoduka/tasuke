import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const PRIORITY_STYLES: Record<string, { label: string; class: string }> = {
  P0: { label: '緊急', class: 'bg-red-100 text-red-700' },
  P1: { label: '高', class: 'bg-yellow-100 text-yellow-700' },
  P2: { label: '中', class: 'bg-blue-100 text-blue-700' },
  P3: { label: '低', class: 'bg-gray-100 text-gray-600' },
};

interface UpcomingDeadline {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  projectId: string;
  projectName: string;
  projectColor: string;
}

interface UpcomingDeadlinesProps {
  data: UpcomingDeadline[];
  workspaceSlug: string;
}

export function UpcomingDeadlines({ data, workspaceSlug }: UpcomingDeadlinesProps) {
  return (
    <div className="rounded-lg bg-g-bg p-5 shadow-sm ring-1 ring-g-border">
      <h2 className="mb-4 text-sm font-semibold text-g-text">期限が迫るタスク（7日以内）</h2>
      {data.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-g-text-muted">
          期限が迫るタスクはありません
        </div>
      ) : (
        <ul className="divide-y divide-g-surface-hover">
          {data.map((task) => {
            const due = new Date(task.dueDate);
            const daysLeft = differenceInDays(due, new Date());
            const priorityStyle = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.P3;
            return (
              <li key={task.id}>
                <Link
                  href={`/${workspaceSlug}/projects/${task.projectId}`}
                  className="flex items-center gap-3 py-3 hover:bg-g-surface -mx-5 px-5 transition-colors"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: task.projectColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-g-text">{task.title}</p>
                    <p className="text-xs text-g-text-muted">{task.projectName}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn('rounded px-1.5 py-0.5 text-xs font-medium', priorityStyle.class)}
                    >
                      {priorityStyle.label}
                    </span>
                    <span
                      className={cn(
                        'text-xs',
                        daysLeft === 0 ? 'font-semibold text-red-600' : 'text-g-text-secondary'
                      )}
                    >
                      {daysLeft === 0
                        ? '今日まで'
                        : `${format(due, 'M/d(E)', { locale: ja })} まで`}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
