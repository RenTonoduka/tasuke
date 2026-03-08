'use client';

import { useCallback, useEffect, useState, useMemo, memo } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CalendarPlus, CalendarCheck, RefreshCw, Trash2, Clock, X, Pencil, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HOUR_HEIGHT,
  GCAL_COLORS,
  GCAL_DEFAULT_COLOR,
  PRIORITY_COLORS,
  minutesToTime,
  isTodayDate,
  isWeekendDate,
  computeOverlapLayout,
} from './schedule-types';
import type { DayData, DayEvent, DayTask, DropIndicator, RegisteredBlock } from './schedule-types';

// Google Calendar MD3 hover shadow
const GCAL_HOVER_SHADOW = '0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12), 0 3px 5px -1px rgba(0,0,0,0.2)';

// --- ユーティリティ ---

function isPastDate(dateStr: string): boolean {
  const today = new Date();
  const d = new Date(dateStr + 'T00:00:00');
  return (
    d.getFullYear() < today.getFullYear() ||
    (d.getFullYear() === today.getFullYear() && d.getMonth() < today.getMonth()) ||
    (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() < today.getDate())
  );
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// --- Event Block (Google Calendar Modern style) ---
// ソリッド背景 + 角丸4px + hover時のみMD3 shadow

function EventBlock({
  ev,
  itemStyle,
  heightPx,
  effectiveEnd,
  isPast,
  isSelected,
  popoverDirection,
  onSelect,
  onDeleteEvent,
  onEditEvent,
  onResizeStart,
  date,
}: {
  ev: DayEvent;
  itemStyle: React.CSSProperties;
  heightPx: number;
  effectiveEnd: number;
  isPast: boolean;
  isSelected: boolean;
  popoverDirection: 'above' | 'below';
  onSelect: (ev: DayEvent | null, direction?: 'above' | 'below') => void;
  onDeleteEvent: (id: string) => void;
  onEditEvent?: (id: string, summary: string, startMin: number, endMin: number) => void;
  onResizeStart?: (id: string, type: 'event' | 'task', clientY: number, endMin: number, date: string, startMin: number) => void;
  date: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event-${ev.id}`,
    data: {
      type: 'timeline-event',
      calendarEventId: ev.id,
      summary: ev.summary,
      durationMin: ev.endMin - ev.startMin,
      colorId: ev.colorId,
    },
  });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ev.summary);
  const [isHovered, setIsHovered] = useState(false);
  const gcalColor = (ev.colorId && GCAL_COLORS[ev.colorId]) || GCAL_DEFAULT_COLOR;
  const isCompact = heightPx < 36;

  return (
    <div
      ref={setNodeRef}
      data-schedule-item
      style={{
        ...itemStyle,
        // hover時にz-indexを最前面に
        ...(isHovered && { zIndex: 50 }),
      }}
    >
      <div
        {...listeners}
        {...attributes}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (!isSelected) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            onSelect(ev, spaceBelow < 200 ? 'above' : 'below');
          } else {
            onSelect(null);
          }
        }}
        className={cn(
          'h-full w-full cursor-pointer overflow-hidden rounded text-xs transition-shadow',
          isDragging && 'opacity-40',
          isPast && 'opacity-70',
          isSelected && 'ring-2 ring-offset-1 ring-[#1a73e8]',
        )}
        style={{
          backgroundColor: gcalColor.bg,
          color: gcalColor.text,
          borderRadius: '4px',
          padding: '2px 8px',
          boxShadow: isHovered ? GCAL_HOVER_SHADOW : undefined,
        }}
        title={`${ev.summary}\n${minutesToTime(ev.startMin)}〜${minutesToTime(effectiveEnd)}`}
      >
        {isCompact ? (
          <span className="line-clamp-1 text-[11px] font-medium leading-snug">
            {minutesToTime(ev.startMin)} {ev.summary}
          </span>
        ) : (
          <>
            <span className="line-clamp-2 text-[12px] font-medium leading-snug">
              {ev.summary}
            </span>
            {heightPx >= 40 && (
              <span className="block text-[10px] opacity-80 leading-snug">
                {minutesToTime(ev.startMin)}〜{minutesToTime(effectiveEnd)}
              </span>
            )}
          </>
        )}
      </div>

      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2.5 cursor-s-resize group"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(ev.id, 'event', e.clientY, ev.endMin, date, ev.startMin);
          }}
        >
          <div className="mx-auto mt-1 h-[3px] w-8 rounded-full bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {isSelected && (
        <div
          data-event-popover
          className={cn(
            'absolute left-0 z-[60] w-[300px] rounded-xl bg-white p-4',
            'shadow-[0_24px_38px_3px_rgba(0,0,0,0.14),0_9px_46px_8px_rgba(0,0,0,0.12),0_11px_15px_-7px_rgba(0,0,0,0.2)]',
            popoverDirection === 'below' ? 'top-full mt-1' : 'bottom-full mb-1',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {editing ? (
            <div className="space-y-3">
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onEditEvent?.(ev.id, editTitle, ev.startMin, ev.endMin);
                    setEditing(false);
                    onSelect(null);
                  }
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-full border-b-2 border-[#1a73e8] bg-transparent px-1 py-1.5 text-[22px] font-normal text-[#202124] focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onEditEvent?.(ev.id, editTitle, ev.startMin, ev.endMin);
                    setEditing(false);
                    onSelect(null);
                  }}
                  className="rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1967d2] hover:shadow-sm"
                >
                  保存
                </button>
                <button
                  onClick={() => { setEditTitle(ev.summary); setEditing(false); }}
                  className="rounded-full px-4 py-2 text-sm font-medium text-[#3c4043] hover:bg-[#f1f3f4]"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-4 w-4 rounded shrink-0" style={{ backgroundColor: gcalColor.bg }} />
                    <span className="text-lg font-normal text-[#3c4043] line-clamp-2">{ev.summary}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#70757a] ml-[26px]">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{minutesToTime(ev.startMin)}〜{minutesToTime(ev.endMin)}</span>
                  </div>
                </div>
                <button
                  onClick={() => onSelect(null)}
                  className="ml-2 shrink-0 rounded-full p-1.5 text-[#5f6368] hover:bg-[#f1f3f4] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex gap-1 border-t border-[#e8eaed] pt-3">
                <button
                  onClick={() => { setEditTitle(ev.summary); setEditing(true); }}
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[#3c4043] hover:bg-[#f1f3f4] transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  編集
                </button>
                <button
                  onClick={() => {
                    onSelect(null);
                    onDeleteEvent(ev.id);
                  }}
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[#3c4043] hover:bg-[#f1f3f4] transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  削除
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Task Block (Google Calendar style — タスクもイベントと同等の見た目) ---

function TaskBlock({
  task,
  itemStyle,
  heightPx,
  effectiveEnd,
  color,
  isPast,
  slotKey,
  isRegistered,
  isRegistering,
  onRegisterBlock,
  onOpenTask,
  onResizeStart,
  date,
}: {
  task: DayTask;
  itemStyle: React.CSSProperties;
  heightPx: number;
  effectiveEnd: number;
  color: string;
  isPast: boolean;
  slotKey: string;
  isRegistered: boolean;
  isRegistering: boolean;
  onRegisterBlock: (taskId: string, date: string, startMin: number, endMin: number) => void;
  onOpenTask: (taskId: string) => void;
  onResizeStart?: (id: string, type: 'event' | 'task', clientY: number, endMin: number, date: string, startMin: number) => void;
  date: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-${task.taskId}-${task.startMin}`,
    data: {
      type: 'timeline-task',
      taskId: task.taskId,
      taskTitle: task.title,
      estimatedHours: (task.endMin - task.startMin) / 60,
      priority: task.priority,
      fromSlotKey: isRegistered ? slotKey : undefined,
    },
  });

  const [isHovered, setIsHovered] = useState(false);
  const isCompact = heightPx < 36;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-schedule-item
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'cursor-grab overflow-hidden text-xs text-white active:cursor-grabbing transition-shadow',
        !isRegistered && 'ring-1 ring-inset ring-white/30',
        isPast && 'opacity-70',
        isDragging && 'opacity-40',
      )}
      style={{
        ...itemStyle,
        backgroundColor: color,
        borderRadius: '4px',
        padding: '2px 8px',
        boxShadow: isHovered ? GCAL_HOVER_SHADOW : undefined,
        ...(isHovered && { zIndex: 50 }),
      }}
      title={`${task.title} (${task.priority})\n${minutesToTime(task.startMin)}〜${minutesToTime(effectiveEnd)}`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onOpenTask(task.taskId); }}
        className="block w-full truncate text-left text-[12px] font-medium leading-snug"
      >
        {task.title}
      </button>
      {!isCompact && (
        <span className="block text-[10px] opacity-80 leading-snug">
          {minutesToTime(task.startMin)}〜{minutesToTime(effectiveEnd)}
        </span>
      )}
      {heightPx >= 52 && (
        <span className="block text-[10px] opacity-60 leading-snug">
          {task.priority} · {((task.endMin - task.startMin) / 60).toFixed(1)}h
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRegisterBlock(task.taskId, date, task.startMin, task.endMin); }}
        disabled={isRegistering}
        className="absolute right-1 top-1 rounded-full p-0.5 hover:bg-white/20 transition-colors"
        title={isRegistered ? 'カレンダー登録解除' : 'Googleカレンダーに登録'}
      >
        {isRegistering ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : isRegistered ? (
          <CalendarCheck className="h-3 w-3" />
        ) : (
          <CalendarPlus className="h-3 w-3 opacity-40" />
        )}
      </button>

      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2.5 cursor-s-resize group"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(task.taskId, 'task', e.clientY, task.endMin, date, task.startMin);
          }}
        >
          <div className="mx-auto mt-1 h-[3px] w-8 rounded-full bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  );
}

// --- Current time indicator (Google Calendar style) ---
// 赤い2px線 + 左端に12pxの赤い丸

function CurrentTimeLine({ workStartMin, hourHeight }: { workStartMin: number; hourHeight: number }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentMin = now.getHours() * 60 + now.getMinutes();
  const top = ((currentMin - workStartMin) / 60) * hourHeight;
  if (top < 0) return null;

  return (
    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top }}>
      <div className="relative">
        <div className="absolute -left-[6px] -top-[5px] h-[12px] w-[12px] rounded-full bg-[#ea4335]" />
        <div className="h-[2px] w-full bg-[#ea4335]" />
      </div>
    </div>
  );
}

// --- All-day events row ---

function AllDayRow({ events }: { events: string[] }) {
  if (events.length === 0) return null;
  return (
    <div className="border-b border-[#dadce0] px-0.5 py-0.5 space-y-0.5">
      {events.slice(0, 3).map((name, i) => (
        <div
          key={i}
          className="truncate rounded px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: '#039BE5', borderRadius: '4px' }}
          title={name}
        >
          {name}
        </div>
      ))}
      {events.length > 3 && (
        <button className="text-[11px] font-medium text-[#1a73e8] px-1 hover:underline">
          +{events.length - 3}件
        </button>
      )}
    </div>
  );
}

// --- Main component ---

interface ScheduleDayColumnProps {
  day: DayData;
  dayColWidth: number;
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

export const ScheduleDayColumn = memo(function ScheduleDayColumn({
  day,
  dayColWidth,
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
}: ScheduleDayColumnProps) {
  const [selectedEvent, setSelectedEvent] = useState<DayEvent | null>(null);
  const [popoverDirection, setPopoverDirection] = useState<'below' | 'above'>('below');

  const { setNodeRef, isOver } = useDroppable({ id: `day-column-${day.date}` });

  const workHours = workEnd - workStart;
  const totalHeight = workHours * HOUR_HEIGHT;
  const workStartMin = workStart * 60;
  const workEndMin = workEnd * 60;
  const isToday = isTodayDate(day.date);
  const isWeekend = isWeekendDate(day.date);
  const isPast = isPastDate(day.date);
  const currentMin = isToday ? getCurrentMinutes() : 0;

  const gridRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      if (node) {
        dayGridRefs.current?.set(day.date, node);
      } else {
        dayGridRefs.current?.delete(day.date);
      }
    },
    [setNodeRef, day.date, dayGridRefs],
  );

  useEffect(() => {
    if (!selectedEvent) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-event-popover]')) {
        setSelectedEvent(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedEvent]);

  // Overlap layout — events + tasks を統合してカラム配置
  const overlapItems = useMemo(() => {
    const items = [
      ...day.events.map((ev, i) => ({
        startMin: Math.max(ev.startMin, workStartMin),
        endMin: Math.min(ev.endMin, workEndMin),
        type: 'event' as const,
        index: i,
      })),
      ...day.tasks.map((task, i) => ({
        startMin: Math.max(task.startMin, workStartMin),
        endMin: Math.min(task.endMin, workEndMin),
        type: 'task' as const,
        index: i,
      })),
    ].filter(item => item.startMin < item.endMin);

    const layoutResults = computeOverlapLayout(items);
    const layoutMap = new Map<string, { column: number; totalColumns: number; span: number }>();
    items.forEach((item, i) => {
      layoutMap.set(`${item.type}-${item.index}`, layoutResults[i]);
    });
    return layoutMap;
  }, [day.events, day.tasks, workStartMin, workEndMin]);

  // Google Calendar: きれいに横並び、各カラムは均等幅、1pxギャップ
  function getItemStyle(type: 'event' | 'task', index: number, topPx: number, heightPx: number): React.CSSProperties {
    const layout = overlapItems.get(`${type}-${index}`);
    const col = layout?.column ?? 0;
    const total = layout?.totalColumns ?? 1;
    const span = layout?.span ?? 1;

    if (total === 1) {
      return {
        position: 'absolute' as const,
        top: topPx,
        height: Math.max(heightPx, 20),
        left: '1px',
        right: '3px',
      };
    }

    // Google Calendar: 均等幅で横並び、1pxのギャップで分離
    const colWidth = 100 / total;
    const leftPct = col * colWidth;
    const widthPct = colWidth * span;

    return {
      position: 'absolute' as const,
      top: topPx,
      height: Math.max(heightPx, 20),
      left: `calc(${leftPct}% + 1px)`,
      width: `calc(${widthPct}% - 2px)`,
      zIndex: col + 1,
    };
  }

  const handleSelect = useCallback((ev: DayEvent | null, direction?: 'above' | 'below') => {
    setSelectedEvent(ev);
    if (direction) setPopoverDirection(direction);
  }, []);

  const handleGridDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onClickCreate) return;
      if ((e.target as HTMLElement).closest('[data-schedule-item]')) return;
      const gridEl = e.currentTarget as HTMLElement;
      const rect = gridEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const rawMin = workStartMin + (y / HOUR_HEIGHT) * 60;
      const startMin = Math.round(rawMin / 15) * 15;
      const endMin = Math.min(startMin + 60, workEndMin);
      onClickCreate(day.date, startMin, endMin);
    },
    [onClickCreate, day.date, workStartMin, workEndMin],
  );

  const showDropIndicator = dropIndicator && dropIndicator.date === day.date;

  const dateObj = new Date(day.date + 'T00:00:00');
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
  const dateNum = dateObj.getDate();

  return (
    <div className="shrink-0 border-l border-[#dadce0]" style={{ width: dayColWidth }}>
      {/* 日付ヘッダー — Google Calendar: 曜日(小) + 日付(大) + 今日は青丸 */}
      <div
        className={cn(
          'flex flex-col items-center justify-center h-16 border-b border-[#dadce0]',
          isWeekend && 'bg-[#f8f9fa]',
        )}
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

      <AllDayRow events={day.allDayEvents} />

      {/* タイムグリッド */}
      <div
        ref={gridRefCallback}
        className={cn(
          'relative',
          isOver ? 'bg-[#e8f0fe]' : isWeekend ? 'bg-[#f8f9fa]' : 'bg-white',
        )}
        style={{ height: totalHeight }}
        onDoubleClick={handleGridDoubleClick}
      >
        {/* 1時間線 */}
        {Array.from({ length: workHours }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 w-full border-b border-[#dadce0]"
            style={{ top: i * HOUR_HEIGHT }}
          />
        ))}
        {/* 30分線 (Google Calendar: 細い破線) */}
        {Array.from({ length: workHours }, (_, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 w-full border-b border-dashed border-[#e8eaed]"
            style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
          />
        ))}

        {/* 現在時刻インジケーター（今日のみ） */}
        {isToday && (
          <CurrentTimeLine workStartMin={workStartMin} hourHeight={HOUR_HEIGHT} />
        )}

        {/* イベント */}
        {day.events.map((ev, i) => {
          const clampedStart = Math.max(ev.startMin, workStartMin);
          const isResizingThis = resizingId === ev.id;
          const effectiveEnd = isResizingThis && resizePreviewEndMin != null ? resizePreviewEndMin : ev.endMin;
          const clampedEnd = Math.min(effectiveEnd, workEndMin);
          if (clampedStart >= clampedEnd) return null;
          const topPx = ((clampedStart - workStartMin) / 60) * HOUR_HEIGHT;
          const heightPx = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;
          const isEventPast = isPast || (isToday && ev.endMin <= currentMin);
          return (
            <EventBlock
              key={ev.id}
              ev={ev}
              itemStyle={getItemStyle('event', i, topPx, heightPx)}
              heightPx={heightPx}
              effectiveEnd={effectiveEnd}
              isPast={isEventPast}
              isSelected={selectedEvent?.id === ev.id}
              popoverDirection={popoverDirection}
              onSelect={handleSelect}
              onDeleteEvent={onDeleteEvent}
              onEditEvent={onEditEvent}
              onResizeStart={onResizeStart}
              date={day.date}
            />
          );
        })}

        {/* ドロップインジケーター */}
        {showDropIndicator && (() => {
          const topPx = ((dropIndicator.startMin - workStartMin) / 60) * HOUR_HEIGHT;
          const heightPx = ((dropIndicator.endMin - dropIndicator.startMin) / 60) * HOUR_HEIGHT;
          return (
            <div
              className="absolute left-1 right-1 z-10 flex items-start rounded bg-[#1a73e8]/15 border-2 border-[#1a73e8] px-2 py-0.5 transition-all duration-100"
              style={{ top: topPx, height: heightPx, borderRadius: '4px' }}
            >
              <span className="text-[11px] font-medium text-[#1a73e8]">
                {minutesToTime(dropIndicator.startMin)}〜{minutesToTime(dropIndicator.endMin)}
              </span>
            </div>
          );
        })()}

        {/* タスク */}
        {day.tasks.map((task, i) => {
          const clampedStart = Math.max(task.startMin, workStartMin);
          const isResizingThis = resizingId === task.taskId;
          const effectiveEnd = isResizingThis && resizePreviewEndMin != null ? resizePreviewEndMin : task.endMin;
          const clampedEnd = Math.min(effectiveEnd, workEndMin);
          if (clampedStart >= clampedEnd) return null;
          const topPx = ((clampedStart - workStartMin) / 60) * HOUR_HEIGHT;
          const heightPx = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;
          const color = PRIORITY_COLORS[task.priority] ?? '#4285F4';
          const slotKey = `${task.taskId}|${day.date}|${minutesToTime(task.startMin)}`;
          const isRegistered = registeredBlocks.has(slotKey);
          const isRegistering = registeringSlot === slotKey;
          const isTaskPast = isPast || (isToday && task.endMin <= currentMin);
          return (
            <TaskBlock
              key={`${task.taskId}-${task.startMin}`}
              task={task}
              itemStyle={getItemStyle('task', i, topPx, heightPx)}
              heightPx={heightPx}
              effectiveEnd={effectiveEnd}
              color={color}
              isPast={isTaskPast}
              slotKey={slotKey}
              isRegistered={isRegistered}
              isRegistering={isRegistering}
              onRegisterBlock={onRegisterBlock}
              onOpenTask={onOpenTask}
              onResizeStart={onResizeStart}
              date={day.date}
            />
          );
        })}
      </div>
    </div>
  );
});
