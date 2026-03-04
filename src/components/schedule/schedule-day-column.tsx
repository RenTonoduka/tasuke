'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CalendarPlus, CalendarCheck, RefreshCw, Trash2, Clock, X, Pencil, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HOUR_HEIGHT,
  GCAL_COLORS,
  GCAL_DEFAULT_COLOR,
  PRIORITY_COLORS,
  minutesToTime,
  formatDateLabel,
  isTodayDate,
  computeOverlapLayout,
} from './schedule-types';
import type { DayData, DayEvent, DayTask, DropIndicator, RegisteredBlock } from './schedule-types';

// --- Event Block (Google Calendar events) ---

function EventBlock({
  ev,
  itemStyle,
  heightPx,
  effectiveEnd,
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
          'h-full w-full cursor-pointer overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-xs font-medium shadow-sm transition-shadow hover:shadow-md',
          isDragging && 'opacity-40',
          isSelected && 'ring-2 ring-offset-1 ring-g-text',
        )}
        style={{
          backgroundColor: `${gcalColor.bg}33`,
          borderLeftColor: gcalColor.bg,
          color: gcalColor.text === '#fff' ? gcalColor.bg : gcalColor.text,
        }}
        title={`${ev.summary} — クリックで詳細 / ドラッグで移動`}
      >
        <span className="line-clamp-2 font-semibold leading-tight text-g-text" style={{ fontSize: '12px' }}>
          {ev.summary}
        </span>
        {heightPx >= 40 && (
          <span className="block text-[11px] opacity-60 mt-0.5">
            {minutesToTime(ev.startMin)}〜{minutesToTime(effectiveEnd)}
          </span>
        )}
      </div>

      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize group"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(ev.id, 'event', e.clientY, ev.endMin, date, ev.startMin);
          }}
        >
          <div className="mx-auto mt-1 h-1 w-8 rounded-full bg-current opacity-0 group-hover:opacity-30 transition-opacity" />
        </div>
      )}

      {isSelected && (
        <div
          data-event-popover
          className={cn(
            'absolute left-0 z-40 w-64 rounded-xl border border-g-border bg-g-bg p-3 shadow-xl',
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
                className="w-full rounded-md border border-g-border bg-g-surface px-2 py-1.5 text-sm text-g-text focus:outline-none focus:ring-2 focus:ring-[#4285F4]"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    onEditEvent?.(ev.id, editTitle, ev.startMin, ev.endMin);
                    setEditing(false);
                    onSelect(null);
                  }}
                  className="flex items-center gap-1 rounded-md bg-[#4285F4] px-3 py-1 text-xs font-medium text-white hover:bg-[#3367D6]"
                >
                  <Check className="h-3 w-3" />
                  保存
                </button>
                <button
                  onClick={() => { setEditTitle(ev.summary); setEditing(false); }}
                  className="rounded-md px-3 py-1 text-xs text-g-text-muted hover:bg-g-surface-hover"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-g-text line-clamp-2">{ev.summary}</span>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-g-text-secondary">
                    <Clock className="h-3.5 w-3.5" />
                    {minutesToTime(ev.startMin)}〜{minutesToTime(ev.endMin)}
                  </div>
                </div>
                <button
                  onClick={() => onSelect(null)}
                  className="ml-1 shrink-0 rounded-md p-1 hover:bg-g-surface-hover"
                >
                  <X className="h-3.5 w-3.5 text-g-text-muted" />
                </button>
              </div>
              <div className="mt-3 flex gap-1 border-t border-g-border pt-2">
                <button
                  onClick={() => { setEditTitle(ev.summary); setEditing(true); }}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-g-text-secondary hover:bg-g-surface-hover"
                >
                  <Pencil className="h-3 w-3" />
                  編集
                </button>
                <button
                  onClick={() => {
                    onSelect(null);
                    onDeleteEvent(ev.id);
                  }}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#EA4335] hover:bg-[#EA4335]/10"
                >
                  <Trash2 className="h-3 w-3" />
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

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-schedule-item
      className={cn(
        'cursor-grab overflow-hidden rounded-md px-2 py-1 text-xs font-medium text-white active:cursor-grabbing shadow-sm transition-shadow hover:shadow-md',
        task.status === 'tight' && 'border-2 border-dashed border-white/50',
        isRegistered && 'ring-2 ring-white/50 ring-offset-1 ring-offset-transparent',
        !isRegistered && 'opacity-80 border border-dashed border-white/30',
        isDragging && 'opacity-40',
      )}
      style={{ ...itemStyle, backgroundColor: color }}
      title={`${task.title} (${task.priority}) — ドラッグで移動`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onOpenTask(task.taskId); }}
        className="block w-full truncate text-left leading-tight hover:opacity-80"
        style={{ fontSize: '12px' }}
      >
        {task.title}
      </button>
      {heightPx >= 42 && (
        <span className="block text-[11px] opacity-70 mt-0.5">
          {minutesToTime(task.startMin)}〜{minutesToTime(effectiveEnd)}
        </span>
      )}
      {heightPx >= 56 && (
        <span className="block text-[10px] opacity-50 mt-0.5">
          {task.priority} · {((task.endMin - task.startMin) / 60).toFixed(1)}h
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRegisterBlock(task.taskId, date, task.startMin, task.endMin); }}
        disabled={isRegistering}
        className="absolute right-1 top-1 rounded-md p-1 hover:bg-white/20 transition-colors"
        title={isRegistered ? 'カレンダー登録解除' : 'Googleカレンダーに登録'}
      >
        {isRegistering ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : isRegistered ? (
          <CalendarCheck className="h-3.5 w-3.5" />
        ) : (
          <CalendarPlus className="h-3.5 w-3.5 opacity-60" />
        )}
      </button>

      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize group"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(task.taskId, 'task', e.clientY, task.endMin, date, task.startMin);
          }}
        >
          <div className="mx-auto mt-1 h-1 w-8 rounded-full bg-white opacity-0 group-hover:opacity-40 transition-opacity" />
        </div>
      )}
    </div>
  );
}

// --- Current time indicator with label ---

function CurrentTimeLine({ workStartMin, hourHeight }: { workStartMin: number; hourHeight: number }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentMin = now.getHours() * 60 + now.getMinutes();
  const top = ((currentMin - workStartMin) / 60) * hourHeight;
  if (top < 0) return null;

  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="relative">
        <div className="absolute -left-1.5 -top-[6px] h-3 w-3 rounded-full bg-[#EA4335] shadow-sm" />
        <div className="h-[2px] w-full bg-[#EA4335]" />
        <span className="absolute -top-[10px] right-1 rounded bg-[#EA4335] px-1 py-0.5 text-[10px] font-medium text-white leading-none">
          {timeLabel}
        </span>
      </div>
    </div>
  );
}

// --- All-day events row ---

function AllDayRow({ events }: { events: string[] }) {
  if (events.length === 0) return null;
  return (
    <div className="border-b border-g-border bg-g-surface px-1 py-1 space-y-0.5">
      {events.slice(0, 3).map((name, i) => (
        <div
          key={i}
          className="truncate rounded bg-[#4285F4]/15 px-1.5 py-0.5 text-[11px] font-medium text-[#4285F4]"
          title={name}
        >
          {name}
        </div>
      ))}
      {events.length > 3 && (
        <span className="text-[10px] text-g-text-muted px-1">
          +{events.length - 3}件
        </span>
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

export function ScheduleDayColumn({
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

  // Popover outside click
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

  // Overlap layout with span support
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

  function getItemStyle(type: 'event' | 'task', index: number, topPx: number, heightPx: number): React.CSSProperties {
    const layout = overlapItems.get(`${type}-${index}`);
    const col = layout?.column ?? 0;
    const total = layout?.totalColumns ?? 1;
    const span = layout?.span ?? 1;
    const colWidth = 100 / total;
    const PAD = 3;
    return {
      position: 'absolute' as const,
      top: topPx,
      height: Math.max(heightPx, 24),
      left: `calc(${col * colWidth}% + ${PAD}px)`,
      width: `calc(${colWidth * span}% - ${PAD * 2}px)`,
    };
  }

  const handleSelect = useCallback((ev: DayEvent | null, direction?: 'above' | 'below') => {
    setSelectedEvent(ev);
    if (direction) setPopoverDirection(direction);
  }, []);

  // Double-click to create event
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

  return (
    <div className="shrink-0 border-l border-g-border" style={{ width: dayColWidth }}>
      {/* 日付ヘッダー */}
      <div
        className={cn(
          'flex flex-col items-center justify-center border-b border-g-border h-12',
          isToday ? 'bg-[#4285F4]/10' : 'bg-g-surface',
        )}
      >
        <span className={cn(
          'text-[11px] font-medium',
          isToday ? 'text-[#4285F4]' : 'text-g-text-muted',
        )}>
          {formatDateLabel(day.date).split('(')[1]?.replace(')', '') || ''}
        </span>
        <span className={cn(
          'text-lg font-bold leading-tight',
          isToday
            ? 'bg-[#4285F4] text-white rounded-full w-8 h-8 flex items-center justify-center text-sm'
            : 'text-g-text',
        )}>
          {new Date(day.date + 'T00:00:00').getDate()}
        </span>
      </div>

      {/* 終日イベント */}
      <AllDayRow events={day.allDayEvents} />

      {/* タイムグリッド */}
      <div
        ref={gridRefCallback}
        className={cn('relative', isOver ? 'bg-[#4285F4]/5' : 'bg-g-bg')}
        style={{ height: totalHeight }}
        onDoubleClick={handleGridDoubleClick}
      >
        {/* 1時間グリッド線 */}
        {Array.from({ length: workHours }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 w-full border-t border-g-border/60"
            style={{ top: i * HOUR_HEIGHT }}
          />
        ))}
        {/* 30分グリッド線 */}
        {Array.from({ length: workHours }, (_, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 w-full border-t border-dashed border-g-border/30"
            style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
          />
        ))}

        {isToday && <CurrentTimeLine workStartMin={workStartMin} hourHeight={HOUR_HEIGHT} />}

        {/* Googleカレンダー予定 */}
        {day.events.map((ev, i) => {
          const clampedStart = Math.max(ev.startMin, workStartMin);
          const isResizingThis = resizingId === ev.id;
          const effectiveEnd = isResizingThis && resizePreviewEndMin != null ? resizePreviewEndMin : ev.endMin;
          const clampedEnd = Math.min(effectiveEnd, workEndMin);
          if (clampedStart >= clampedEnd) return null;
          const topPx = ((clampedStart - workStartMin) / 60) * HOUR_HEIGHT;
          const heightPx = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;
          return (
            <EventBlock
              key={ev.id}
              ev={ev}
              itemStyle={getItemStyle('event', i, topPx, heightPx)}
              heightPx={heightPx}
              effectiveEnd={effectiveEnd}
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
              className="absolute left-1 right-1 z-10 flex items-start rounded-lg border-2 border-[#4285F4] bg-[#4285F4]/15 px-2 py-1 shadow-sm transition-all duration-100"
              style={{ top: topPx, height: heightPx }}
            >
              <span className="text-xs font-semibold text-[#4285F4]">
                {minutesToTime(dropIndicator.startMin)}〜{minutesToTime(dropIndicator.endMin)}
              </span>
            </div>
          );
        })()}

        {/* タスクスロット */}
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
          return (
            <TaskBlock
              key={`${task.taskId}-${task.startMin}`}
              task={task}
              itemStyle={getItemStyle('task', i, topPx, heightPx)}
              heightPx={heightPx}
              effectiveEnd={effectiveEnd}
              color={color}
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
}
