'use client';

import { memo } from 'react';
import { addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { TimelineBar } from './timeline-bar';
import type { Task } from '@/types';

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#EA4335',
  P1: '#FBBC04',
  P2: '#4285F4',
  P3: '#80868B',
};

const DAY_WIDTH = 32;
const ROW_HEIGHT = 40;

interface TimelineRowProps {
  task: Task;
  rangeStart: Date;
  totalDays: number;
  today: Date;
  onClick: () => void;
}

export const TimelineRow = memo(function TimelineRow({
  task,
  rangeStart,
  totalDays,
  today,
  onClick,
}: TimelineRowProps) {
  const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  const color = PRIORITY_COLORS[task.priority] ?? '#80868B';
  const isDone = task.status === 'DONE';

  return (
    <div
      className="flex hover:bg-[#F8F9FA] cursor-pointer group"
      style={{ height: ROW_HEIGHT }}
      onClick={onClick}
    >
      {/* Left panel: task info */}
      <div className="hidden md:flex w-60 shrink-0 items-center gap-2 border-r border-b border-[#E8EAED] px-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          title={task.priority}
        />
        <span
          className={cn(
            'flex-1 truncate text-sm text-[#202124]',
            isDone && 'line-through text-[#80868B]'
          )}
        >
          {task.title}
        </span>
      </div>

      {/* Right panel: gantt bar area */}
      <div
        className="relative border-b border-[#E8EAED]"
        style={{ width: totalDays * DAY_WIDTH }}
      >
        {/* Background grid columns */}
        {days.map((day, i) => {
          const dow = day.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isToday =
            day.getFullYear() === today.getFullYear() &&
            day.getMonth() === today.getMonth() &&
            day.getDate() === today.getDate();
          return (
            <div
              key={i}
              className={cn(
                'absolute top-0 h-full border-r border-[#F1F3F4]',
                isWeekend && 'bg-[#F8F9FA]'
              )}
              style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
            >
              {isToday && (
                <div className="absolute top-0 left-[15px] h-full w-0.5 bg-[#EA4335] opacity-60" />
              )}
            </div>
          );
        })}

        {/* Bar */}
        <TimelineBar task={task} rangeStart={rangeStart} today={today} />
      </div>
    </div>
  );
});
