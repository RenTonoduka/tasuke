'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
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
import type { DayData, DayEvent, TaskSuggestion } from './schedule-types';

interface ScheduleDayColumnProps {
  day: DayData;
  dayColWidth: number;
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
  onDeleteEvent: (eventId: string) => void;
  onClickCreate?: (date: string, startMin: number, endMin: number) => void;
  onResizeStart?: (id: string, type: 'event' | 'task', clientY: number, endMin: number, date: string, startMin: number) => void;
  resizingId?: string | null;
  resizePreviewEndMin?: number;
  suggestions: TaskSuggestion[] | null;
  allDaysEvents: DayEvent[];
}

// 現在時刻インジケーター
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

export function ScheduleDayColumn({
  day,
  dayColWidth,
  workStart,
  workEnd,
  draggingTask,
  dropTarget,
  registeredBlocks,
  registeringSlot,
  onDragStartTask,
  onDragStartEvent,
  onDragEnd,
  onDropTargetChange,
  onDrop,
  onRegisterBlock,
  onOpenTask,
  onDeleteEvent,
  onClickCreate,
  onResizeStart,
  resizingId,
  resizePreviewEndMin,
  suggestions,
  allDaysEvents,
}: ScheduleDayColumnProps) {
  const [selectedEvent, setSelectedEvent] = useState<DayEvent | null>(null);
  const [popoverDirection, setPopoverDirection] = useState<'below' | 'above'>('below');
  const gridRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const workHours = workEnd - workStart;
  const totalHeight = workHours * HOUR_HEIGHT;
  const workStartMin = workStart * 60;
  const workEndMin = workEnd * 60;
  const isToday = isTodayDate(day.date);
  const isDropTarget = draggingTask && dropTarget?.date === day.date;

  // 重複レイアウト計算
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

  function getItemStyle(type: 'event' | 'task', index: number, topPx: number, heightPx: number) {
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

  const calcDropTime = useCallback(
    (clientY: number) => {
      const el = gridRef.current;
      if (!el) return workStartMin;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top;
      const rawMin = workStartMin + (y / HOUR_HEIGHT) * 60;
      const snappedMin = Math.round(rawMin / 15) * 15;
      return Math.max(workStartMin, Math.min(snappedMin, workEndMin - 15));
    },
    [workStartMin, workEndMin],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const clientY = e.clientY;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const startMin = calcDropTime(clientY);
        onDropTargetChange({ date: day.date, startMin });
      });
    },
    [calcDropTime, day.date, onDropTargetChange],
  );

  const handleDragLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onDropTargetChange(null);
  }, [onDropTargetChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const startMin = calcDropTime(e.clientY);
      onDrop(e, day.date, startMin);
    },
    [onDrop, day.date, calcDropTime],
  );

  // クリックでタスク作成
  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onClickCreate) return;
      // イベント/タスク上のクリックは除外
      if ((e.target as HTMLElement).closest('[data-schedule-item]')) return;
      const startMin = calcDropTime(e.clientY);
      const endMin = Math.min(startMin + 60, workEndMin);
      onClickCreate(day.date, startMin, endMin);
    },
    [onClickCreate, calcDropTime, day.date, workEndMin],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="shrink-0 border-l border-g-border" style={{ width: dayColWidth }}>
      {/* 日付ヘッダー */}
      <div
        className={cn(
          'flex flex-col items-center justify-center border-b border-g-border py-1.5 min-h-[40px]',
          isToday ? 'bg-[#4285F4]/10' : 'bg-g-surface',
        )}
      >
        <span className={cn('text-xs font-medium', isToday ? 'text-[#4285F4]' : 'text-g-text')}>
          {formatDateLabel(day.date)}
        </span>
        {day.allDayEvents.length > 0 && (
          <div className="mt-0.5 w-full px-1">
            {day.allDayEvents.slice(0, 2).map((name, i) => (
              <span key={i} className="block truncate text-[9px] text-g-text-muted">
                {name}
              </span>
            ))}
            {day.allDayEvents.length > 2 && (
              <span className="block text-[9px] font-medium text-[#4285F4]">
                +{day.allDayEvents.length - 2} 件
              </span>
            )}
          </div>
        )}
      </div>

      {/* タイムグリッド */}
      <div
        ref={gridRef}
        className={cn('relative', isDropTarget ? 'bg-[#4285F4]/5' : 'bg-g-bg')}
        style={{ height: totalHeight }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleGridClick}
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

        {/* 現在時刻インジケーター */}
        {isToday && <CurrentTimeLine workStartMin={workStartMin} hourHeight={HOUR_HEIGHT} />}

        {/* Googleカレンダー予定 */}
        {day.events.map((ev, i) => {
          const clampedStart = Math.max(ev.startMin, workStartMin);
          const clampedEnd = Math.min(ev.endMin, workEndMin);
          if (clampedStart >= clampedEnd) return null;
          const topPx = ((clampedStart - workStartMin) / 60) * HOUR_HEIGHT;
          const heightPx = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;
          const gcalColor = (ev.colorId && GCAL_COLORS[ev.colorId]) || GCAL_DEFAULT_COLOR;
          const isSelected = selectedEvent?.id === ev.id;
          return (
            <div key={`ev-${i}`} data-schedule-item style={getItemStyle('event', i, topPx, heightPx)}>
              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  onDragStartEvent(e, ev);
                }}
                onDragEnd={onDragEnd}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isSelected) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    setPopoverDirection(spaceBelow < 200 ? 'above' : 'below');
                  }
                  setSelectedEvent(isSelected ? null : ev);
                }}
                className={cn(
                  'h-full w-full cursor-pointer overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] font-medium shadow-sm',
                  draggingTask === `cal-${ev.id}` && 'opacity-40',
                  isSelected && 'ring-2 ring-offset-1 ring-g-text',
                )}
                style={{
                  backgroundColor: gcalColor.bg,
                  color: gcalColor.text,
                }}
                title={`${ev.summary} — クリックで詳細 / ドラッグで移動`}
              >
                <span className="line-clamp-1 leading-tight">{ev.summary}</span>
                {heightPx >= 32 && (
                  <span className="block text-[9px] opacity-70">
                    {minutesToTime(ev.startMin)}〜{minutesToTime(ev.endMin)}
                  </span>
                )}
              </div>

              {/* リサイズハンドル */}
              {onResizeStart && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-black/10 rounded-b-md"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onResizeStart(ev.id, 'event', e.clientY, ev.endMin, day.date, ev.startMin);
                  }}
                />
              )}

              {/* イベント詳細ポップオーバー */}
              {isSelected && (
                <div
                  className={cn(
                    'absolute left-0 z-30 w-48 rounded-lg border border-g-border bg-g-bg p-2 shadow-lg',
                    popoverDirection === 'below' ? 'top-full mt-1' : 'bottom-full mb-1',
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-medium text-g-text line-clamp-2">{ev.summary}</span>
                    <button
                      onClick={() => setSelectedEvent(null)}
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
                        setSelectedEvent(null);
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
        })}

        {/* ドロップインジケーター */}
        {isDropTarget &&
          (() => {
            const draggedSuggestion = suggestions?.find((s) => s.taskId === draggingTask);
            const draggedEvent = draggingTask?.startsWith('cal-')
              ? allDaysEvents.find((ev) => `cal-${ev.id}` === draggingTask)
              : null;
            const hours =
              draggedSuggestion?.estimatedHours ??
              (draggedEvent ? (draggedEvent.endMin - draggedEvent.startMin) / 60 : 1);
            const indicatorStartMin = dropTarget!.startMin;
            const indicatorEndMin = Math.min(indicatorStartMin + hours * 60, workEndMin);
            const topPx = ((indicatorStartMin - workStartMin) / 60) * HOUR_HEIGHT;
            const heightPx = ((indicatorEndMin - indicatorStartMin) / 60) * HOUR_HEIGHT;
            return (
              <div
                className="absolute left-1 right-1 z-10 flex items-start rounded border-2 border-dashed border-[#4285F4] bg-[#4285F4]/10 px-1.5 py-0.5"
                style={{ top: topPx, height: heightPx }}
              >
                <span className="text-[10px] font-medium text-[#4285F4]">
                  {minutesToTime(indicatorStartMin)}〜{minutesToTime(indicatorEndMin)}
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
          const durationHours = (task.endMin - task.startMin) / 60;
          return (
            <div
              key={`task-${i}`}
              data-schedule-item
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                onDragStartTask(
                  e,
                  task.taskId,
                  durationHours,
                  task.priority,
                  isRegistered ? slotKey : undefined,
                );
              }}
              onDragEnd={onDragEnd}
              className={cn(
                'cursor-grab overflow-hidden rounded px-1.5 py-0.5 text-[10px] font-medium text-white active:cursor-grabbing',
                task.status === 'tight' && 'border-2 border-dashed border-white',
                isRegistered && 'ring-2 ring-white/70',
                draggingTask === task.taskId && 'opacity-40',
              )}
              style={{
                ...getItemStyle('task', i, topPx, heightPx),
                backgroundColor: color,
              }}
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
                onClick={(e) => { e.stopPropagation(); onRegisterBlock(task.taskId, day.date, task.startMin, task.endMin); }}
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

              {/* リサイズハンドル */}
              {onResizeStart && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-white/20 rounded-b"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onResizeStart(task.taskId, 'task', e.clientY, task.endMin, day.date, task.startMin);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
