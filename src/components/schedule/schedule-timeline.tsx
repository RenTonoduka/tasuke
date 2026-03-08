'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { HOUR_HEIGHT, MIN_DAY_COL_WIDTH, TIME_LABEL_WIDTH, isTodayDate, isWeekendDate } from './schedule-types';
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

// 日付ヘッダー（sticky用に分離）
function DayHeader({ day, width }: { day: DayData; width: number }) {
  const isToday = isTodayDate(day.date);
  const isWeekend = isWeekendDate(day.date);
  const dateObj = new Date(day.date + 'T00:00:00');
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
  const dateNum = dateObj.getDate();

  return (
    <div
      className={cn(
        'shrink-0 flex flex-col items-center justify-center h-16 border-l border-[#dadce0]',
        isWeekend && 'bg-[#f8f9fa]',
      )}
      style={{ width }}
    >
      <span className={cn(
        'text-[11px] font-medium uppercase tracking-wider',
        isToday ? 'text-[#1a73e8]' : 'text-[#70757a]',
      )}>
        {dayOfWeek}
      </span>
      <span className={cn(
        'leading-none mt-0.5',
        isToday
          ? 'bg-[#1a73e8] text-white rounded-full w-[44px] h-[44px] flex items-center justify-center text-[20px] font-medium'
          : 'text-[26px] font-normal text-[#3c4043]',
      )}>
        {dateNum}
      </span>
    </div>
  );
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

  const hasAllDay = daysData.some(d => d.allDayEvents.length > 0);
  const allDayHeight = hasAllDay
    ? Math.min(Math.max(...daysData.map(d => d.allDayEvents.length)), 3) * 22 + 6
    : 0;

  return (
    <div ref={containerRef}>
      <div style={{ minWidth: TIME_LABEL_WIDTH + daysData.length * MIN_DAY_COL_WIDTH }}>
        {/* ===== Sticky ヘッダー行 ===== */}
        <div className="sticky top-0 z-20 bg-white border-b border-[#dadce0]">
          <div className="flex">
            {/* 時刻ラベル列のスペーサー */}
            <div className="shrink-0 h-16" style={{ width: TIME_LABEL_WIDTH }} />
            {/* 日付ヘッダー */}
            {daysData.map((day) => (
              <DayHeader key={day.date} day={day} width={dayColWidth} />
            ))}
          </div>

          {/* 終日イベント行（ヘッダーに含める） */}
          {hasAllDay && (
            <div className="flex border-t border-[#e8eaed]">
              <div className="shrink-0" style={{ width: TIME_LABEL_WIDTH }} />
              {daysData.map((day) => (
                <div
                  key={day.date}
                  className="shrink-0 border-l border-[#dadce0] px-0.5 py-0.5 space-y-0.5"
                  style={{ width: dayColWidth, minHeight: allDayHeight }}
                >
                  {day.allDayEvents.slice(0, 3).map((name, i) => (
                    <div
                      key={i}
                      className="truncate rounded px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ backgroundColor: '#039BE5', borderRadius: '4px' }}
                      title={name}
                    >
                      {name}
                    </div>
                  ))}
                  {day.allDayEvents.length > 3 && (
                    <button className="text-[11px] font-medium text-[#1a73e8] px-1 hover:underline">
                      +{day.allDayEvents.length - 3}件
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== タイムグリッド本体 ===== */}
        <div className="flex">
          {/* 時刻ラベル列 */}
          <div className="shrink-0" style={{ width: TIME_LABEL_WIDTH }}>
            <div className="relative" style={{ height: totalHeight }}>
              {Array.from({ length: workHours + 1 }, (_, i) => (
                <span
                  key={i}
                  className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-[#70757a] tabular-nums select-none"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  {String(workStart + i).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>

          {/* 日付カラム（ヘッダーなし — stickyヘッダーに分離済み） */}
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
    </div>
  );
}
