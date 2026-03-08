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

// --- ユーティリティ ---

/** HEXカラーを暗くする */
function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

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

// --- Event Block (Google Calendar style) ---
// Google Calendar: ソリッド背景 + 左に濃いボーダー4px + rounded 4px

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
  const gcalColor = (ev.colorId && GCAL_COLORS[ev.colorId]) || GCAL_DEFAULT_COLOR;
  const isCompact = heightPx < 36;

  return (
    <div ref={setNodeRef} data-schedule-item style={itemStyle}>
      <div
        {...listeners}
        {...attributes}
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
          'h-full w-full cursor-pointer overflow-hidden px-1.5 py-0.5 text-xs transition-shadow hover:shadow-lg',
          isDragging && 'opacity-40',
          isPast && 'opacity-60',
          isSelected && 'ring-2 ring-offset-1 ring-[#1a73e8]',
        )}
        style={{
          backgroundColor: isPast ? `${gcalColor.bg}99` : gcalColor.bg,
          color: gcalColor.text,
          borderRadius: '4px',
          borderLeft: `4px solid ${darkenColor(gcalColor.bg, 0.15)}`,
        }}
        title={`${ev.summary} — クリックで詳細 / ドラッグで移動`}
      >
        {isCompact ? (
          <span className="line-clamp-1 text-[11px] font-medium leading-tight">
            {minutesToTime(ev.startMin)} {ev.summary}
          </span>
        ) : (
          <>
            <span className="line-clamp-2 text-[12px] font-medium leading-tight">
              {ev.summary}
            </span>
            {heightPx >= 36 && (
              <span className="block text-[10px] opacity-80 mt-0.5">
                {minutesToTime(ev.startMin)}〜{minutesToTime(effectiveEnd)}
              </span>
            )}
          </>
        )}
      </div>

      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize group"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(ev.id, 'event', e.clientY, ev.endMin, date, ev.startMin);
          }}
        >
          <div className="mx-auto mt-0.5 h-0.5 w-6 rounded-full bg-white opacity-0 group-hover:opacity-60 transition-opacity" />
        </div>
      )}

      {isSelected && (
        <div
          data-event-popover
          className={cn(
            'absolute left-0 z-40 w-72 rounded-lg bg-white p-4 shadow-[0_8px_10px_1px_rgba(60,64,67,0.15),0_3px_14px_2px_rgba(60,64,67,0.12),0_5px_5px_-3px_rgba(60,64,67,0.2)]',
            popoverDirection === 'below' ? 'top-full mt-1' : 'bottom-full mb-1',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {editing ? (
            <div className="space-y-2">
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
                className="w-full rounded border border-[#dadce0] bg-white px-2.5 py-1.5 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    onEditEvent?.(ev.id, editTitle, ev.startMin, ev.endMin);
                    setEditing(false);
                    onSelect(null);
                  }}
                  className="flex items-center gap-1 rounded-full bg-[#1a73e8] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#1967d2]"
                >
                  <Check className="h-3 w-3" />
                  保存
                </button>
                <button
                  onClick={() => { setEditTitle(ev.summary); setEditing(false); }}
                  className="rounded-full px-3.5 py-1.5 text-xs text-[#5f6368] hover:bg-[#f0f4f9]"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3.5 w-3.5 rounded-sm shrink-0" style={{ backgroundColor: gcalColor.bg }} />
                    <span className="text-sm font-normal text-[#202124] line-clamp-2">{ev.summary}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#5f6368]">
                    <Clock className="h-3.5 w-3.5" />
                    {minutesToTime(ev.startMin)}〜{minutesToTime(ev.endMin)}
                  </div>
                </div>
                <button
                  onClick={() => onSelect(null)}
                  className="ml-1 shrink-0 rounded-full p-1.5 hover:bg-[#f0f4f9]"
                >
                  <X className="h-4 w-4 text-[#5f6368]" />
                </button>
              </div>
              <div className="mt-3 flex gap-1 border-t border-[#dadce0] pt-2.5">
                <button
                  onClick={() => { setEditTitle(ev.summary); setEditing(true); }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[#5f6368] hover:bg-[#f0f4f9]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  編集
                </button>
                <button
                  onClick={() => {
                    onSelect(null);
                    onDeleteEvent(ev.id);
                  }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[#5f6368] hover:bg-[#f0f4f9]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
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

// --- Task Block ---

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

  const isCompact = heightPx < 36;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-schedule-item
      className={cn(
        'cursor-grab overflow-hidden px-1.5 py-0.5 text-xs text-white active:cursor-grabbing transition-shadow hover:shadow-md',
        !isRegistered && 'border border-dashed border-white/40',
        isRegistered && 'shadow-sm',
        task.status === 'tight' && 'border-2 border-dashed border-white/50',
        isPast && 'opacity-50',
        !isPast && !isRegistered && 'opacity-70',
        isDragging && 'opacity-40',
      )}
      style={{
        ...itemStyle,
        backgroundColor: isPast ? `${color}99` : color,
        borderRadius: '4px',
        borderLeft: `4px solid ${darkenColor(color, 0.2)}`,
      }}
      title={`${task.title} (${task.priority}) — ドラッグで移動`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onOpenTask(task.taskId); }}
        className="block w-full truncate text-left text-[12px] font-medium leading-tight hover:opacity-80"
      >
        {task.title}
      </button>
      {!isCompact && (
        <span className="block text-[10px] opacity-75 mt-0.5">
          {minutesToTime(task.startMin)}〜{minutesToTime(effectiveEnd)}
        </span>
      )}
      {heightPx >= 48 && (
        <span className="block text-[10px] opacity-50 mt-0.5">
          {task.priority} · {((task.endMin - task.startMin) / 60).toFixed(1)}h
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRegisterBlock(task.taskId, date, task.startMin, task.endMin); }}
        disabled={isRegistering}
        className="absolute right-0.5 top-0.5 rounded p-0.5 hover:bg-white/20 transition-colors"
        title={isRegistered ? 'カレンダー登録解除' : 'Googleカレンダーに登録'}
      >
        {isRegistering ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : isRegistered ? (
          <CalendarCheck className="h-3 w-3" />
        ) : (
          <CalendarPlus className="h-3 w-3 opacity-50" />
        )}
      </button>

      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize group"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(task.taskId, 'task', e.clientY, task.endMin, date, task.startMin);
          }}
        >
          <div className="mx-auto mt-0.5 h-0.5 w-6 rounded-full bg-white opacity-0 group-hover:opacity-40 transition-opacity" />
        </div>
      )}
    </div>
  );
}

// --- Past time overlay (Google Calendar style) ---

function PastTimeOverlay({ workStartMin, hourHeight }: { workStartMin: number; hourHeight: number }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentMin = now.getHours() * 60 + now.getMinutes();
  const top = ((currentMin - workStartMin) / 60) * hourHeight;
  if (top <= 0) return null;

  return (
    <div
      className="absolute left-0 right-0 top-0 z-[1] pointer-events-none bg-white/40"
      style={{ height: Math.max(0, top) }}
    />
  );
}

// --- Current time indicator (Google Calendar style) ---

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
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="relative">
        <div className="absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full bg-[#ea4335]" />
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
          className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
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

  // Overlap layout
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

  // Google Calendar style: 重なりアイテムのスタイル計算
  // - 重なりなし → フル幅
  // - 重なりあり → カラム幅配分 + 右カラムは手前に浮き出す（shadow + z-index）
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
        left: '2px',
        right: '4px',
      };
    }

    // Google Calendar実装:
    // - 左イベント: 全幅の (span/total)×100% を占有
    // - 右イベント: 左イベントに少し被さる形で配置（左に数px食い込む）
    // - 右イベントほど手前（高いz-index + box-shadow）
    const baseWidth = 100 / total;
    const leftPercent = col * baseWidth;
    const widthPercent = baseWidth * span;

    // 右カラムのイベントは左に少し食い込む（Google Calendar風の重なり）
    const OVERLAP_PX = col > 0 ? 8 : 0;

    return {
      position: 'absolute' as const,
      top: topPx,
      height: Math.max(heightPx, 20),
      left: `calc(${leftPercent}% - ${OVERLAP_PX}px)`,
      width: `calc(${Math.min(widthPercent, 100 - leftPercent)}% + ${OVERLAP_PX}px - 3px)`,
      zIndex: col + 1,
      // 右カラム（手前）のイベントに影をつけて奥行きを表現
      ...(col > 0 && {
        boxShadow: '-2px 0 4px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
      }),
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
      {/* 日付ヘッダー */}
      <div
        className={cn(
          'flex flex-col items-center justify-center h-14 border-b border-[#dadce0]',
          isPast && 'opacity-50',
          isWeekend && !isPast && 'bg-[#f8f9fa]',
        )}
      >
        <span className={cn(
          'text-[11px] font-medium uppercase tracking-wide',
          isToday ? 'text-[#1a73e8]' : 'text-[#70757a]',
        )}>
          {dayOfWeek}
        </span>
        <span className={cn(
          'text-[22px] font-normal leading-none mt-0.5',
          isToday
            ? 'bg-[#1a73e8] text-white rounded-full w-[36px] h-[36px] flex items-center justify-center text-[14px] font-medium'
            : 'text-[#202124]',
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
          isOver ? 'bg-[#1a73e8]/5' : isPast ? 'bg-[#f8f9fa]' : isWeekend ? 'bg-[#fafafa]' : 'bg-white',
        )}
        style={{ height: totalHeight }}
        onDoubleClick={handleGridDoubleClick}
      >
        {Array.from({ length: workHours }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 w-full border-t border-[#dadce0]"
            style={{ top: i * HOUR_HEIGHT }}
          />
        ))}
        {Array.from({ length: workHours }, (_, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 w-full border-t border-dashed border-[#e8eaed]"
            style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
          />
        ))}

        {isToday && (
          <>
            <PastTimeOverlay workStartMin={workStartMin} hourHeight={HOUR_HEIGHT} />
            <CurrentTimeLine workStartMin={workStartMin} hourHeight={HOUR_HEIGHT} />
          </>
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
              className="absolute left-0.5 right-0.5 z-10 flex items-start rounded border-2 border-[#1a73e8] bg-[#1a73e8]/15 px-1.5 py-0.5 transition-all duration-100"
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
