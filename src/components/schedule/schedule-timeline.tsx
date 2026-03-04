'use client';

import { useRef, useState, useEffect } from 'react';
import { HOUR_HEIGHT, MIN_DAY_COL_WIDTH, TIME_LABEL_WIDTH } from './schedule-types';
import type { DayData, DropIndicator, RegisteredBlock } from './schedule-types';
import { ScheduleDayColumn } from './schedule-day-column';

interface ScheduleTimelineProps {
  daysData: DayData[];
  workStart: number;
  workEnd: number;
  registeredBlocks: Map<string, RegisteredBlock>;
  registeringSlot: string | null;
  onRegisterBlock: (taskId: string, date: string, startMin: number, endMin: number) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onEditEvent?: (eventId: string, summary: string, startMin: number, endMin: number) => void;
  onClickCreate?: (date: string, startMin: number, endMin: number) => void;
  onResizeStart?: (id: string, type: 'event' | 'task', clientY: number, endMin: number, date: string, startMin: number) => void;
  resizingId?: string | null;
  resizePreviewEndMin?: number;
  dropIndicator: DropIndicator | null;
  dayGridRefs: React.RefObject<Map<string, HTMLElement>>;
}

export function ScheduleTimeline({
  daysData,
  workStart,
  workEnd,
  registeredBlocks,
  registeringSlot,
  onRegisterBlock,
  onOpenTask,
  onDeleteEvent,
  onEditEvent,
  onClickCreate,
  onResizeStart,
  resizingId,
  resizePreviewEndMin,
  dropIndicator,
  dayGridRefs,
}: ScheduleTimelineProps) {
  const workHours = workEnd - workStart;
  const totalHeight = workHours * HOUR_HEIGHT;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dayCount = daysData.length;
  const dayColWidth = containerWidth > 0
    ? Math.max(MIN_DAY_COL_WIDTH, Math.floor((containerWidth - TIME_LABEL_WIDTH) / dayCount))
    : MIN_DAY_COL_WIDTH;

  return (
    <div ref={containerRef} className="overflow-x-auto">
      <div className="flex" style={{ minWidth: TIME_LABEL_WIDTH + daysData.length * MIN_DAY_COL_WIDTH }}>
        {/* 時刻ラベル列 */}
        <div className="shrink-0" style={{ width: TIME_LABEL_WIDTH }}>
          {/* ヘッダー高さ分 + 終日イベント分を空ける */}
          <div className="h-12" />
          {/* 終日イベントがある場合のスペーサー — 各日の最大終日イベント数に合わせる */}
          {daysData.some(d => d.allDayEvents.length > 0) && (
            <div className="border-b border-g-border" style={{ height: Math.min(Math.max(...daysData.map(d => d.allDayEvents.length)), 3) * 24 + 8 || 0 }} />
          )}
          <div className="relative" style={{ height: totalHeight }}>
            {Array.from({ length: workHours + 1 }, (_, i) => (
              <span
                key={i}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-g-text-muted tabular-nums"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {String(workStart + i).padStart(2, '0')}:00
              </span>
            ))}
          </div>
        </div>

        {/* 日付カラム */}
        {daysData.map((day) => (
          <ScheduleDayColumn
            key={day.date}
            day={day}
            dayColWidth={dayColWidth}
            workStart={workStart}
            workEnd={workEnd}
            registeredBlocks={registeredBlocks}
            registeringSlot={registeringSlot}
            onRegisterBlock={onRegisterBlock}
            onOpenTask={onOpenTask}
            onDeleteEvent={onDeleteEvent}
            onEditEvent={onEditEvent}
            onClickCreate={onClickCreate}
            onResizeStart={onResizeStart}
            resizingId={resizingId}
            resizePreviewEndMin={resizePreviewEndMin}
            dropIndicator={dropIndicator}
            dayGridRefs={dayGridRefs}
          />
        ))}
      </div>
    </div>
  );
}
