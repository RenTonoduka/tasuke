'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { subDays, addDays } from 'date-fns';
import { PRIORITY_COLORS } from '@/lib/constants';
import type { Task } from '@/types';

const DAY_WIDTH = 32;
const RESIZE_HANDLE_WIDTH = 8;

interface TimelineBarProps {
  task: Task;
  rangeStart: Date;
  today: Date;
  onDateChange?: (taskId: string, startDate: string | null, dueDate: string | null) => void;
}

export function TimelineBar({ task, rangeStart, today, onDateChange }: TimelineBarProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [resizeOffset, setResizeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ x: number; type: 'move' | 'resize' } | null>(null);

  const { left, width, isOverdue, hasNoDates, effectiveStartDate, effectiveEndDate } = useMemo(() => {
    const due = task.dueDate ? new Date(task.dueDate) : null;
    const start = task.startDate ? new Date(task.startDate) : null;

    if (!due && !start) {
      return { left: 0, width: 0, isOverdue: false, hasNoDates: true, effectiveStartDate: null, effectiveEndDate: null };
    }

    const effectiveStart = start ?? subDays(due!, 3);
    const effectiveEnd = due ?? start!;

    const startOffset = Math.floor(
      (effectiveStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const durationDays = Math.max(
      1,
      Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    const isOverdue = !!due && due < today && task.status !== 'DONE';

    return {
      left: startOffset * DAY_WIDTH,
      width: durationDays * DAY_WIDTH,
      isOverdue,
      hasNoDates: false,
      effectiveStartDate: effectiveStart,
      effectiveEndDate: effectiveEnd,
    };
  }, [task, rangeStart, today]);

  const handlePointerDown = useCallback((e: React.PointerEvent, type: 'move' | 'resize') => {
    if (hasNoDates || !onDateChange) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, type };
    if (type === 'move') setIsDragging(true);
    else setIsResizing(true);
  }, [hasNoDates, onDateChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    if (dragStartRef.current.type === 'move') {
      setDragOffset(dx);
    } else {
      setResizeOffset(dx);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || !effectiveStartDate || !effectiveEndDate || !onDateChange) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const daysDelta = Math.round(dx / DAY_WIDTH);
    const type = dragStartRef.current.type;

    dragStartRef.current = null;
    setDragOffset(0);
    setResizeOffset(0);
    setIsDragging(false);
    setIsResizing(false);

    if (daysDelta === 0) return;

    if (type === 'move') {
      const newStart = addDays(effectiveStartDate, daysDelta);
      const newEnd = addDays(effectiveEndDate, daysDelta);
      onDateChange(task.id, newStart.toISOString(), newEnd.toISOString());
    } else {
      const newEnd = addDays(effectiveEndDate, daysDelta);
      if (newEnd >= effectiveStartDate) {
        onDateChange(task.id, effectiveStartDate.toISOString(), newEnd.toISOString());
      }
    }
  }, [effectiveStartDate, effectiveEndDate, onDateChange, task.id]);

  if (hasNoDates) {
    return (
      <span className="text-xs text-g-text-muted italic">期限未設定</span>
    );
  }

  const color = PRIORITY_COLORS[task.priority] ?? '#4285F4';
  const isDone = task.status === 'DONE';
  const canDrag = !!onDateChange;

  const displayLeft = left + (isDragging ? dragOffset : 0);
  const displayWidth = width + (isResizing ? resizeOffset : 0);

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2"
      style={{
        left: displayLeft,
        width: Math.max(DAY_WIDTH, displayWidth),
        cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
      }}
      onPointerDown={(e) => handlePointerDown(e, 'move')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="relative h-6 rounded select-none"
        style={{
          backgroundColor: color,
          opacity: isDone ? 0.4 : isDragging || isResizing ? 0.7 : 1,
        }}
        title={task.title}
      >
        <div className="absolute inset-0 flex items-center px-1.5">
          <span className={`w-full truncate text-[10px] text-white ${isDone ? 'line-through opacity-80' : ''}`}>
            {task.title}
          </span>
        </div>
        {isOverdue && (
          <div
            className="absolute -right-1 top-0 h-full w-1.5 rounded-r-sm bg-[#EA4335]"
            title="期限超過"
          />
        )}
        {/* Resize handle (right edge) */}
        {canDrag && (
          <div
            className="absolute right-0 top-0 h-full cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity"
            style={{ width: RESIZE_HANDLE_WIDTH }}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e, 'resize');
            }}
          >
            <div className="absolute right-0.5 top-1/2 -translate-y-1/2 h-3 w-1 rounded-full bg-white/60" />
          </div>
        )}
      </div>
    </div>
  );
}
