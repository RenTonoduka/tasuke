'use client';

import { HOUR_HEIGHT, DAY_COL_WIDTH } from './schedule-types';
import type { DayData, DayEvent, TaskSuggestion } from './schedule-types';
import { ScheduleDayColumn } from './schedule-day-column';

interface ScheduleTimelineProps {
  daysData: DayData[];
  workStart: number;
  workEnd: number;
  draggingTask: string | null;
  dropTarget: { date: string; startMin: number } | null;
  registeredBlocks: Map<string, string>;
  registeringSlot: string | null;
  onDragStartTask: (
    e: React.DragEvent,
    taskId: string,
    hours: number,
    priority: string,
    fromSlotKey?: string,
  ) => void;
  onDragStartEvent: (e: React.DragEvent, ev: DayEvent) => void;
  onDragEnd: () => void;
  onDropTargetChange: (target: { date: string; startMin: number } | null) => void;
  onDrop: (e: React.DragEvent, date: string, startMin: number) => void;
  onRegisterBlock: (taskId: string, date: string, startMin: number, endMin: number) => void;
  onOpenTask: (taskId: string) => void;
  suggestions: TaskSuggestion[] | null;
}

export function ScheduleTimeline({
  daysData,
  workStart,
  workEnd,
  suggestions,
  ...dndProps
}: ScheduleTimelineProps) {
  const workHours = workEnd - workStart;
  const totalHeight = workHours * HOUR_HEIGHT;

  // 全日のイベントをフラット化（ドロップインジケーターのイベント検索用）
  const allDaysEvents: DayEvent[] = daysData.flatMap((d) => d.events);

  return (
    <div className="overflow-x-auto">
      <div className="flex" style={{ minWidth: 60 + daysData.length * DAY_COL_WIDTH }}>
        {/* 時刻ラベル列 */}
        <div className="shrink-0" style={{ width: 52 }}>
          <div className="h-10" />
          <div className="relative" style={{ height: totalHeight }}>
            {Array.from({ length: workHours + 1 }, (_, i) => (
              <span
                key={i}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-g-text-muted"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {workStart + i}:00
              </span>
            ))}
          </div>
        </div>

        {/* 日付カラム */}
        {daysData.map((day) => (
          <ScheduleDayColumn
            key={day.date}
            day={day}
            workStart={workStart}
            workEnd={workEnd}
            suggestions={suggestions}
            allDaysEvents={allDaysEvents}
            {...dndProps}
          />
        ))}
      </div>
    </div>
  );
}
