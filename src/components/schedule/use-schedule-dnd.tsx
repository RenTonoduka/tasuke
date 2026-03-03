'use client';

import { useCallback, useState, useRef } from 'react';
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  rectIntersection,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { HOUR_HEIGHT, minutesToTime } from './schedule-types';
import type { ScheduleDragData, DropIndicator, RegisteredBlock } from './schedule-types';

interface UseScheduleDndOptions {
  workStartMin: number;
  workEndMin: number;
  registeredBlocks: Map<string, RegisteredBlock>;
  setRegisteredBlocks: React.Dispatch<React.SetStateAction<Map<string, RegisteredBlock>>>;
  setRegisteringSlot: (slot: string | null) => void;
  fetchSchedule: () => void;
  dayGridRefs: React.RefObject<Map<string, HTMLElement>>;
}

export function useScheduleDnd({
  workStartMin,
  workEndMin,
  registeredBlocks,
  setRegisteredBlocks,
  setRegisteringSlot,
  fetchSchedule,
  dayGridRefs,
}: UseScheduleDndOptions) {
  const [activeDragData, setActiveDragData] = useState<ScheduleDragData | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const droppingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const dayColumns = args.droppableContainers.filter(
      (c) => String(c.id).startsWith('day-column-'),
    );
    return rectIntersection({ ...args, droppableContainers: dayColumns });
  }, []);

  const calcDropMinute = useCallback(
    (clientY: number, gridElement: HTMLElement) => {
      const rect = gridElement.getBoundingClientRect();
      const y = clientY - rect.top;
      const rawMin = workStartMin + (y / HOUR_HEIGHT) * 60;
      const snappedMin = Math.round(rawMin / 15) * 15;
      return Math.max(workStartMin, Math.min(snappedMin, workEndMin - 15));
    },
    [workStartMin, workEndMin],
  );

  const getDurationMin = useCallback((data: ScheduleDragData) => {
    if (data.type === 'timeline-event') return data.durationMin;
    return data.estimatedHours * 60;
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as ScheduleDragData;
    setActiveDragData(data);
  }, []);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!event.over) {
        setDropIndicator(null);
        return;
      }
      const overId = String(event.over.id);
      if (!overId.startsWith('day-column-')) {
        setDropIndicator(null);
        return;
      }
      const date = overId.replace('day-column-', '');
      const gridEl = dayGridRefs.current?.get(date);
      if (!gridEl) {
        setDropIndicator(null);
        return;
      }

      const initialEvent = event.activatorEvent as PointerEvent;
      const clientY = initialEvent.clientY + event.delta.y;
      const startMin = calcDropMinute(clientY, gridEl);

      const data = event.active.data.current as ScheduleDragData;
      const durationMin = getDurationMin(data);
      const endMin = Math.min(startMin + durationMin, workEndMin);

      setDropIndicator({ date, startMin, endMin });
    },
    [calcDropMinute, workEndMin, dayGridRefs, getDurationMin],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const data = activeDragData;
      const indicator = dropIndicator;
      setActiveDragData(null);
      setDropIndicator(null);

      if (!data || !indicator || !event.over || droppingRef.current) return;
      droppingRef.current = true;

      try {
        if (data.type === 'timeline-event') {
          // Googleカレンダーイベント移動
          const startISO = `${indicator.date}T${minutesToTime(indicator.startMin)}:00`;
          const endISO = `${indicator.date}T${minutesToTime(indicator.endMin)}:00`;
          const oldStartISO = startISO; // undo用に後で使う
          const oldEndISO = endISO;

          const res = await fetch('/api/calendar/events', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: data.calendarEventId, start: startISO, end: endISO }),
          });
          if (res.ok) {
            fetchSchedule();
            // undo情報は元の時間がないため、fetchScheduleで更新
          } else {
            const err = await res.json().catch(() => ({}));
            toast({ title: 'イベントの移動に失敗', description: err.error, variant: 'destructive' });
          }
        } else if (data.type === 'sidebar-task') {
          // サイドバーからの新規配置
          const start = minutesToTime(indicator.startMin);
          const end = minutesToTime(indicator.endMin);
          const slotKey = `${data.taskId}|${indicator.date}|${start}`;

          if (registeredBlocks.has(slotKey)) return;

          setRegisteringSlot(slotKey);
          try {
            const res = await fetch('/api/calendar/schedule-block', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId: data.taskId, date: indicator.date, start, end }),
            });
            if (res.ok) {
              const block = await res.json();
              const blockInfo: RegisteredBlock = { id: block.id, endTime: end };
              setRegisteredBlocks((prev) => new Map(prev).set(slotKey, blockInfo));
              fetchSchedule();
              toast({
                title: `「${data.taskTitle}」を配置しました`,
                action: (
                  <ToastAction altText="元に戻す" onClick={async () => {
                    await fetch('/api/calendar/schedule-block', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ scheduleBlockId: block.id }),
                    });
                    setRegisteredBlocks((prev) => {
                      const m = new Map(prev);
                      m.delete(slotKey);
                      return m;
                    });
                    fetchSchedule();
                  }}>
                    元に戻す
                  </ToastAction>
                ),
              });
            } else {
              const err = await res.json().catch(() => ({}));
              toast({ title: 'ブロックの登録に失敗', description: err.error, variant: 'destructive' });
            }
          } finally {
            setRegisteringSlot(null);
          }
        } else if (data.type === 'timeline-task') {
          // タイムライン上タスクの移動
          const start = minutesToTime(indicator.startMin);
          const end = minutesToTime(indicator.endMin);
          const newSlotKey = `${data.taskId}|${indicator.date}|${start}`;

          if (data.fromSlotKey && data.fromSlotKey === newSlotKey) return;
          if (!data.fromSlotKey) return; // 未登録は移動不可

          const oldBlock = registeredBlocks.get(data.fromSlotKey);
          if (!oldBlock) return;

          setRegisteringSlot(newSlotKey);
          try {
            // 新しいブロック作成
            const postRes = await fetch('/api/calendar/schedule-block', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId: data.taskId, date: indicator.date, start, end }),
            });
            if (!postRes.ok) {
              const err = await postRes.json().catch(() => ({}));
              toast({ title: 'ブロックの移動に失敗', description: err.error, variant: 'destructive' });
              return;
            }
            const newBlock = await postRes.json();

            // 旧ブロック削除
            const deleteRes = await fetch('/api/calendar/schedule-block', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scheduleBlockId: oldBlock.id }),
            });

            const newBlockInfo: RegisteredBlock = { id: newBlock.id, endTime: end };
            setRegisteredBlocks((prev) => {
              const m = new Map(prev);
              m.delete(data.fromSlotKey!);
              m.set(newSlotKey, newBlockInfo);
              return m;
            });

            if (!deleteRes.ok) {
              toast({ title: '旧ブロックの削除に失敗', description: 'カレンダーから手動で削除してください', variant: 'destructive' });
            }

            fetchSchedule();
            toast({
              title: `「${data.taskTitle}」を移動しました`,
              action: (
                <ToastAction altText="元に戻す" onClick={async () => {
                  // 新ブロック削除 + 旧位置に再作成
                  await fetch('/api/calendar/schedule-block', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scheduleBlockId: newBlock.id }),
                  });
                  const [, oldDate, oldStart] = data.fromSlotKey!.split('|');
                  const restoreRes = await fetch('/api/calendar/schedule-block', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId: data.taskId, date: oldDate, start: oldStart, end: oldBlock.endTime }),
                  });
                  if (restoreRes.ok) {
                    const restored = await restoreRes.json();
                    setRegisteredBlocks((prev) => {
                      const m = new Map(prev);
                      m.delete(newSlotKey);
                      m.set(data.fromSlotKey!, { id: restored.id, endTime: oldBlock.endTime });
                      return m;
                    });
                  }
                  fetchSchedule();
                }}>
                  元に戻す
                </ToastAction>
              ),
            });
          } finally {
            setRegisteringSlot(null);
          }
        }
      } finally {
        droppingRef.current = false;
      }
    },
    [activeDragData, dropIndicator, registeredBlocks, setRegisteredBlocks, setRegisteringSlot, fetchSchedule],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragData(null);
    setDropIndicator(null);
  }, []);

  return {
    activeDragData,
    dropIndicator,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  };
}
