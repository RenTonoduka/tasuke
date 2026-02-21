'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { TimelineBar } from './timeline-bar';
import { PRIORITY_COLORS } from '@/lib/constants';
import type { Task } from '@/types';

export const DAY_WIDTH = 32;
const ROW_HEIGHT = 40;

interface TimelineRowProps {
  task: Task;
  rangeStart: Date;
  totalDays: number;
  today: Date;
  onClick: () => void;
  onDateChange?: (taskId: string, startDate: string | null, dueDate: string | null) => void;
}

export const TimelineRow = memo(function TimelineRow({
  task,
  rangeStart,
  totalDays,
  today,
  onClick,
  onDateChange,
}: TimelineRowProps) {
  const color = PRIORITY_COLORS[task.priority] ?? '#80868B';
  const isDone = task.status === 'DONE';

  return (
    <div
      className="flex hover:bg-g-surface cursor-pointer group"
      style={{ height: ROW_HEIGHT }}
      onClick={onClick}
    >
      {/* Left panel: task info */}
      <div className="hidden md:flex w-60 shrink-0 items-center gap-2 border-r border-b border-g-border px-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          title={task.priority}
        />
        <span
          className={cn(
            'flex-1 truncate text-sm text-g-text',
            isDone && 'line-through text-g-text-muted'
          )}
        >
          {task.title}
        </span>
      </div>

      {/* Right panel: gantt bar area */}
      <div
        className="relative border-b border-g-border"
        style={{ width: totalDays * DAY_WIDTH }}
      >
        <TimelineBar
          task={task}
          rangeStart={rangeStart}
          today={today}
          onDateChange={onDateChange}
        />
      </div>
    </div>
  );
});
