'use client';

import { Clock, AlertTriangle, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIORITY_COLORS, formatDueDate } from './schedule-types';
import type { TaskSuggestion, UnschedulableTask } from './schedule-types';

interface ScheduleTaskListProps {
  suggestions: TaskSuggestion[];
  draggingTask: string | null;
  onDragStart: (e: React.DragEvent, taskId: string, hours: number, priority: string) => void;
  onDragEnd: () => void;
  onOpenTask: (taskId: string) => void;
}

export function ScheduleTaskList({
  suggestions,
  draggingTask,
  onDragStart,
  onDragEnd,
  onOpenTask,
}: ScheduleTaskListProps) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-g-text-secondary">
        <Clock className="h-3.5 w-3.5" />
        タスク一覧
        <span className="text-[10px] text-g-text-muted">（ドラッグしてタイムラインに配置）</span>
      </h3>
      <div className="space-y-1">
        {suggestions.map((s) => (
          <div
            key={s.taskId}
            draggable
            onDragStart={(e) => onDragStart(e, s.taskId, s.estimatedHours, s.priority)}
            onDragEnd={onDragEnd}
            className={cn(
              'flex w-full cursor-grab items-center gap-3 rounded-md border border-g-border px-3 py-2 text-left text-xs hover:bg-g-surface active:cursor-grabbing',
              draggingTask === s.taskId && 'opacity-50',
            )}
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-g-text-muted" />
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: PRIORITY_COLORS[s.priority] }}
            />
            <button
              onClick={() => onOpenTask(s.taskId)}
              className="min-w-0 flex-1 truncate font-medium text-g-text text-left hover:underline"
            >
              {s.taskTitle}
            </button>
            <span className="shrink-0 text-g-text-muted">
              {s.totalScheduledHours}/{s.estimatedHours}h
            </span>
            <span className="shrink-0 text-g-text-muted">期限: {formatDueDate(s.dueDate)}</span>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                s.status === 'schedulable' && 'bg-g-success-bg text-[#34A853]',
                s.status === 'tight' && 'bg-g-warning-bg text-[#FBBC04]',
                s.status === 'overdue' && 'bg-g-error-bg text-[#EA4335]',
              )}
            >
              {s.status === 'schedulable' ? '配置可能' : s.status === 'tight' ? '時間不足' : '期限超過'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ScheduleUnschedulableProps {
  items: UnschedulableTask[];
  onOpenTask: (taskId: string) => void;
}

export function ScheduleUnschedulable({ items, onOpenTask }: ScheduleUnschedulableProps) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-[#EA4335]">
        <AlertTriangle className="h-3.5 w-3.5" />
        スケジュール不可（空き時間不足）
      </h3>
      <div className="space-y-1">
        {items.map((t) => (
          <button
            key={t.taskId}
            onClick={() => onOpenTask(t.taskId)}
            className="flex w-full items-center gap-3 rounded-md border border-[#FCE8E6] bg-g-warning-bg px-3 py-2 text-left text-xs hover:bg-g-error-bg"
          >
            <span className="font-medium text-g-text">{t.taskTitle}</span>
            <span className="text-g-text-muted">期限: {formatDueDate(t.dueDate)}</span>
            <span className="text-[#EA4335]">{t.reason}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
