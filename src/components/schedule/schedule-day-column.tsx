'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CalendarPlus, CalendarCheck, RefreshCw, Trash2, Clock, X } from 'lucide-react';
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

// --- Sub-components for useDraggable ---

function EventBlock({
  ev,
  itemStyle,
  heightPx,
  effectiveEnd,
  isSelected,
  popoverDirection,
  onSelect,
  onDeleteEvent,
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
          'h-full w-full cursor-pointer overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] font-medium shadow-sm',
          isDragging && 'opacity-40',
          isSelected && 'ring-2 ring-offset-1 ring-g-text',
        )}
        style={{ backgroundColor: gcalColor.bg, color: gcalColor.text }}
        title={`${ev.summary} — クリックで詳細 / ドラッグで移動`}
      >
        <span className="line-clamp-1 leading-tight">{ev.summary}</span>
        {heightPx >= 32 && (
          <span className="block text-[9px] opacity-70">
            {minutesToTime(ev.startMin)}〜{minutesToTime(effectiveEnd)}
          </span>
        )}
      </div>

      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-black/10 rounded-b-md"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(ev.id, 'event', e.clientY, ev.endMin, date, ev.startMin);
          }}
        />
      )}

      {isSelected && (
        <div
          data-event-popover
          className={cn(
            'absolute left-0 z-30 w-48 rounded-lg border border-g-border bg-g-bg p-2 shadow-lg',
            popoverDirection === 'below' ? 'top-full mt-1' : 'bottom-full mb-1',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-g-text line-clamp-2">{ev.summary}</span>
            <button
              onClick={() => onSelect(null)}
              className="ml-1 shrink-0 rounded p-0.5 hover:bg-g-surface-hover"
            >
              <X className="h-3 w-3 text-g-text-muted" />
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-g-text-secondary">
            <Clock className="h-3 w-3" />
            {minutesToTime(ev.startMin)}〜{minutesToTime(ev.endMin)}
          </div>
          <div className="mt-2 flex gap-1">
            <button
              onClick={() => {
                onSelect(null);
                onDeleteEvent(ev.id);
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-[#EA4335] hover:bg-[#EA4335]/10"
            >
              <Trash2 className="h-3 w-3" />
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
        'cursor-grab overflow-hidden rounded px-1.5 py-0.5 text-[10px] font-medium text-white active:cursor-grabbing',
        task.status === 'tight' && 'border-2 border-dashed border-white',
        isRegistered && 'ring-2 ring-white/70',
        isDragging && 'opacity-40',
      )}
      style={{ ...itemStyle, backgroundColor: color }}
      title={`${task.title} (${task.priority}) — ドラッグで移動`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onOpenTask(task.taskId); }}
        className="block w-full truncate text-left leading-tight hover:opacity-80"
      >
        {task.title}
      </button>
      {heightPx >= 36 && (
        <span className="block text-[9px] opacity-70">
          {minutesToTime(task.startMin)}〜{minutesToTime(effectiveEnd)}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRegisterBlock(task.taskId, date, task.startMin, task.endMin); }}
        disabled={isRegistering}
        className="absolute right-1 top-0.5 rounded p-0.5 hover:bg-white/20"
        title={isRegistered ? 'カレンダー登録解除' : 'Googleカレンダーに登録'}
      >
        {isRegistering ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : isRegistered ? (
          <CalendarCheck className="h-3 w-3" />
        ) : (
          <CalendarPlus className="h-3 w-3 opacity-70" />
        )}
      </button>

      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-white/20 rounded-b"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(task.taskId, 'task', e.clientY, task.endMin, date, task.startMin);
          }}
        />
      )}
    </div>
  );
}

// --- Current time indicator ---

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
        <div className="absolute -left-1 -top-[5px] h-[10px] w-[10px] rounded-full bg-[#EA4335]" />
        <div className="h-[2px] w-full bg-[#EA4335]" />
      </div>
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

  // Combine refs: useDroppable + dayGridRefs
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
    const layoutMap = new Map<string, { column: number; totalColumns: number }>();
    items.forEach((item, i) => {
      layoutMap.set(`${item.type}-${item.index}`, layoutResults[i]);
    });
    return layoutMap;
  }, [day.events, day.tasks, workStartMin, workEndMin]);

  function getItemStyle(type: 'event' | 'task', index: number, topPx: number, heightPx: number): React.CSSProperties {
    const layout = overlapItems.get(`${type}-${index}`);
    const col = layout?.column ?? 0;
    const total = layout?.totalColumns ?? 1;
    const colWidth = 100 / total;
    const PAD = 2;
    return {
      position: 'absolute' as const,
      top: topPx,
      height: Math.max(heightPx, 20),
      left: `calc(${col * colWidth}% + ${PAD}px)`,
      width: `calc(${colWidth}% - ${PAD * 2}px)`,
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
      {/* 日付ヘッダー — fixed h-10 */}
      <div
        className={cn(
          'flex items-center justify-center gap-1.5 border-b border-g-border h-10',
          isToday ? 'bg-[#4285F4]/10' : 'bg-g-surface',
        )}
      >
        <span className={cn('text-xs font-medium', isToday ? 'text-[#4285F4]' : 'text-g-text')}>
          {formatDateLabel(day.date)}
        </span>
        {day.allDayEvents.length > 0 && (
          <span
            className="rounded-full bg-g-surface-hover px-1.5 text-[9px] text-g-text-muted cursor-default"
            title={day.allDayEvents.join('\n')}
          >
            終日{day.allDayEvents.length}
          </span>
        )}
      </div>

      {/* タイムグリッド */}
      <div
        ref={gridRefCallback}
        className={cn('relative', isOver ? 'bg-[#4285F4]/5' : 'bg-g-bg')}
        style={{ height: totalHeight }}
        onDoubleClick={handleGridDoubleClick}
      >
        {/* 時刻グリッド線 */}
        {Array.from({ length: workHours }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 w-full border-t border-g-surface-hover"
            style={{ top: i * HOUR_HEIGHT }}
          />
        ))}
        {/* 30分線 */}
        {Array.from({ length: workHours }, (_, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 w-full border-t border-dashed border-g-surface-hover/50"
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
              className="absolute left-1 right-1 z-10 flex items-start rounded border-2 border-dashed border-[#4285F4] bg-[#4285F4]/10 px-1.5 py-0.5"
              style={{ top: topPx, height: heightPx }}
            >
              <span className="text-[10px] font-medium text-[#4285F4]">
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
