'use client';

import { memo } from 'react';
import { TimelineBar } from './timeline-bar';
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
  return (
    // バー領域のみ。タスク名は timeline-view.tsx の固定左パネルが描画する。
    // 幅 totalDays*DAY_WIDTH・x=0 起点にすることで日付ヘッダー／今日の縦線と整列する。
    <div
      className="relative border-b border-g-border hover:bg-g-surface cursor-pointer group"
      style={{ height: ROW_HEIGHT, width: totalDays * DAY_WIDTH }}
      onClick={onClick}
    >
      <TimelineBar
        task={task}
        rangeStart={rangeStart}
        today={today}
        onDateChange={onDateChange}
      />
    </div>
  );
});
