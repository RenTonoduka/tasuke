'use client';

import { useMemo } from 'react';
import { subDays } from 'date-fns';
import { PRIORITY_COLORS } from '@/lib/constants';
import type { Task } from '@/types';

const DAY_WIDTH = 32;

interface TimelineBarProps {
  task: Task;
  rangeStart: Date;
  today: Date;
}

export function TimelineBar({ task, rangeStart, today }: TimelineBarProps) {
  const { left, width, isOverdue, hasNoDates } = useMemo(() => {
    const due = task.dueDate ? new Date(task.dueDate) : null;
    const start = task.startDate ? new Date(task.startDate) : null;

    if (!due && !start) {
      return { left: 0, width: 0, isOverdue: false, hasNoDates: true };
    }

    const effectiveStart = start ?? subDays(due!, 3);
    const effectiveEnd = due ?? start!;

    const startOffset = Math.floor(
      (effectiveStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const durationDays = Math.max(
      1,
      Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    const isOverdue = !!due && due < today && task.status !== 'DONE';

    return {
      left: startOffset * DAY_WIDTH,
      width: durationDays * DAY_WIDTH,
      isOverdue,
      hasNoDates: false,
    };
  }, [task, rangeStart, today]);

  if (hasNoDates) {
    return (
      <span className="text-xs text-g-text-muted italic">期限未設定</span>
    );
  }

  const color = PRIORITY_COLORS[task.priority] ?? '#4285F4';
  const isDone = task.status === 'DONE';

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2"
      style={{ left, width }}
    >
      <div
        className="relative h-6 rounded"
        style={{
          backgroundColor: color,
          opacity: isDone ? 0.4 : 1,
        }}
        title={task.title}
      >
        {isDone && (
          <div className="absolute inset-0 flex items-center px-1.5">
            <span className="w-full truncate text-[10px] text-white line-through opacity-80">
              {task.title}
            </span>
          </div>
        )}
        {!isDone && (
          <div className="absolute inset-0 flex items-center px-1.5">
            <span className="w-full truncate text-[10px] text-white">
              {task.title}
            </span>
          </div>
        )}
        {isOverdue && (
          <div
            className="absolute -right-1 top-0 h-full w-1.5 rounded-r-sm bg-[#EA4335]"
            title="期限超過"
          />
        )}
      </div>
    </div>
  );
}
