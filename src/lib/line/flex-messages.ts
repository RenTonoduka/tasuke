const STATUS_LABEL: Record<string, string> = {
  TODO: '未着手',
  IN_PROGRESS: '進行中',
  DONE: '完了',
};

interface TaskSection {
  label: string;
  tasks: { title: string; dueDate?: string | null; priority?: string }[];
}

export function buildDashboardText(data: Record<string, unknown[]>): string {
  const sections: TaskSection[] = [
    { label: '⚠️ 期限切れ', tasks: (data.overdue ?? []) as TaskSection['tasks'] },
    { label: '📅 今日期限', tasks: (data.dueToday ?? []) as TaskSection['tasks'] },
    { label: '📋 今週期限', tasks: (data.dueThisWeek ?? []) as TaskSection['tasks'] },
    { label: '🔄 進行中', tasks: (data.inProgress ?? []) as TaskSection['tasks'] },
  ].filter(s => s.tasks.length > 0);

  if (sections.length === 0) {
    return '未完了のタスクはありません。';
  }

  return sections.map(s => {
    const taskLines = s.tasks.slice(0, 5).map(t => {
      const parts = [`  ・${t.title}`];
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        parts.push(`(${d.getMonth() + 1}/${d.getDate()})`);
      }
      return parts.join(' ');
    });
    const more = s.tasks.length > 5 ? `\n  ...他${s.tasks.length - 5}件` : '';
    return `${s.label} ${s.tasks.length}件\n${taskLines.join('\n')}${more}`;
  }).join('\n\n');
}

export function formatTaskStatus(status: string): string {
  return STATUS_LABEL[status] ?? status;
}
