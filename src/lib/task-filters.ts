import type { FilterState } from '@/stores/filter-store';
import type { Task } from '@/types';

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function filterTasks(tasks: Task[], filters: FilterState): Task[] {
  let result = tasks;

  // ステータスフィルタ
  if (filters.status.length > 0) {
    result = result.filter((t) => filters.status.includes(t.status));
  }

  // 優先度フィルタ
  if (filters.priority.length > 0) {
    result = result.filter((t) => filters.priority.includes(t.priority));
  }

  // 担当者フィルタ
  if (filters.assignee.length > 0) {
    result = result.filter((t) =>
      t.assignees.some((a) => filters.assignee.includes(a.user.id))
    );
  }

  // ラベルフィルタ
  if (filters.label.length > 0) {
    result = result.filter((t) =>
      t.labels.some((l) => filters.label.includes(l.label.id))
    );
  }

  // 期限フィルタ
  if (filters.dueDateFilter !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    result = result.filter((t) => {
      if (filters.dueDateFilter === 'no-date') return !t.dueDate;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      if (filters.dueDateFilter === 'overdue') return due < today && t.status !== 'DONE';
      if (filters.dueDateFilter === 'today') return due >= today && due < new Date(today.getTime() + 86400000);
      if (filters.dueDateFilter === 'this-week') return due >= today && due < weekEnd;
      return true;
    });
  }

  // ソート
  if (filters.sortBy !== 'position') {
    const dir = filters.sortOrder === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (filters.sortBy) {
        case 'created':
          return dir * (new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
        case 'due': {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return dir * (da - db);
        }
        case 'priority':
          return dir * ((PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
        case 'title':
          return dir * a.title.localeCompare(b.title, 'ja');
        default:
          return 0;
      }
    });
  }

  return result;
}
