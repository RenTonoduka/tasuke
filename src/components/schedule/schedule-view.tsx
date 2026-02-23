'use client';

import { useState, useCallback } from 'react';
import { CalendarClock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { useScheduleData } from './use-schedule-data';
import { ScheduleHeader } from './schedule-header';
import { ScheduleTimeline } from './schedule-timeline';
import { ScheduleTaskList, ScheduleUnschedulable } from './schedule-task-list';
import { minutesToTime } from './schedule-types';
import type { ScheduleViewProps, DayEvent } from './schedule-types';

export function ScheduleView({ projectId, myTasksOnly }: ScheduleViewProps) {
  const {
    data,
    loading,
    daysData,
    registeredBlocks,
    setRegisteredBlocks,
    registeringSlot,
    setRegisteringSlot,
    savedSettings,
    editingSettings,
    setEditingSettings,
    handleSaveSettings,
    fetchSchedule,
  } = useScheduleData(projectId, myTasksOnly);

  const [showSettings, setShowSettings] = useState(false);
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ date: string; startMin: number } | null>(null);
  const openPanel = useTaskPanelStore((s) => s.open);

  const workEndMin = savedSettings.workEnd * 60;

  // D&D: タスクドラッグ開始
  const handleDragStartTask = useCallback(
    (
      e: React.DragEvent,
      taskId: string,
      estimatedHours: number,
      priority: string,
      fromSlotKey?: string,
    ) => {
      e.dataTransfer.setData(
        'text/plain',
        JSON.stringify({ taskId, estimatedHours, priority, fromSlotKey }),
      );
      e.dataTransfer.effectAllowed = 'move';
      setDraggingTask(taskId);
    },
    [],
  );

  // D&D: カレンダーイベントドラッグ開始
  const handleDragStartEvent = useCallback((e: React.DragEvent, ev: DayEvent) => {
    const durationMin = ev.endMin - ev.startMin;
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        calendarEventId: ev.id,
        durationMin,
        estimatedHours: durationMin / 60,
      }),
    );
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTask(`cal-${ev.id}`);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingTask(null);
    setDropTarget(null);
  }, []);

  // D&D: ドロップ処理（startMinはDayColumnのgridRefで正確に計算済み）
  const handleDrop = useCallback(
    async (e: React.DragEvent, date: string, startMin: number) => {
      e.preventDefault();
      setDropTarget(null);
      setDraggingTask(null);

      let payload: {
        taskId?: string;
        estimatedHours?: number;
        fromSlotKey?: string;
        calendarEventId?: string;
        durationMin?: number;
      };
      try {
        payload = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch {
        return;
      }

      // Googleカレンダーイベントの移動
      if (payload.calendarEventId) {
        const durationMin = payload.durationMin ?? 60;
        const endMin = Math.min(startMin + durationMin, workEndMin);
        if (endMin <= startMin) return;

        const startISO = `${date}T${minutesToTime(startMin)}:00`;
        const endISO = `${date}T${minutesToTime(endMin)}:00`;

        try {
          const res = await fetch('/api/calendar/events', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId: payload.calendarEventId,
              start: startISO,
              end: endISO,
            }),
          });
          if (res.ok) {
            fetchSchedule();
          } else {
            const err = await res.json().catch(() => ({}));
            toast({
              title: 'カレンダーイベントの移動に失敗',
              description: err.error,
              variant: 'destructive',
            });
          }
        } catch {
          toast({ title: 'カレンダーイベントの移動に失敗', variant: 'destructive' });
        }
        return;
      }

      // タスクの配置/移動
      const { taskId, estimatedHours, fromSlotKey } = payload;
      if (!taskId || !estimatedHours) return;

      const endMin = Math.min(startMin + estimatedHours * 60, workEndMin);
      if (endMin <= startMin) return;

      const start = minutesToTime(startMin);
      const end = minutesToTime(endMin);
      const newSlotKey = `${taskId}|${date}|${start}`;

      if (fromSlotKey && fromSlotKey === newSlotKey) return;
      if (!fromSlotKey && registeredBlocks.has(newSlotKey)) return;

      setRegisteringSlot(newSlotKey);
      try {
        if (fromSlotKey && registeredBlocks.has(fromSlotKey)) {
          // 移動: POST（新作成）→ DELETE（旧削除）の順でロバスト化
          const oldBlockId = registeredBlocks.get(fromSlotKey)!;

          const postRes = await fetch('/api/calendar/schedule-block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, date, start, end }),
          });

          if (!postRes.ok) {
            const err = await postRes.json().catch(() => ({}));
            toast({
              title: 'ブロックの移動に失敗',
              description: err.error,
              variant: 'destructive',
            });
            return;
          }

          const newBlock = await postRes.json();

          const deleteRes = await fetch('/api/calendar/schedule-block', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleBlockId: oldBlockId }),
          });

          setRegisteredBlocks((prev) => {
            const m = new Map(prev);
            m.delete(fromSlotKey);
            m.set(newSlotKey, newBlock.id);
            return m;
          });

          if (!deleteRes.ok) {
            toast({
              title: '旧ブロックの削除に失敗',
              description: 'カレンダーから手動で削除してください',
              variant: 'destructive',
            });
          }

          fetchSchedule();
        } else {
          // 新規配置
          const res = await fetch('/api/calendar/schedule-block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, date, start, end }),
          });
          if (res.ok) {
            const block = await res.json();
            setRegisteredBlocks((prev) => new Map(prev).set(newSlotKey, block.id));
            fetchSchedule();
          } else {
            const err = await res.json().catch(() => ({}));
            toast({
              title: 'ブロックの登録に失敗',
              description: err.error,
              variant: 'destructive',
            });
          }
        }
      } finally {
        setRegisteringSlot(null);
      }
    },
    [workEndMin, registeredBlocks, setRegisteredBlocks, setRegisteringSlot, fetchSchedule],
  );

  // カレンダー登録/解除
  const handleRegisterBlock = useCallback(
    async (taskId: string, date: string, startMin: number, endMin: number) => {
      const start = minutesToTime(startMin);
      const slotKey = `${taskId}|${date}|${start}`;

      if (registeredBlocks.has(slotKey)) {
        const blockId = registeredBlocks.get(slotKey)!;
        setRegisteringSlot(slotKey);
        try {
          const res = await fetch('/api/calendar/schedule-block', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleBlockId: blockId }),
          });
          if (res.ok) {
            setRegisteredBlocks((prev) => {
              const m = new Map(prev);
              m.delete(slotKey);
              return m;
            });
          } else {
            toast({ title: 'カレンダー登録解除に失敗', variant: 'destructive' });
          }
        } finally {
          setRegisteringSlot(null);
        }
        return;
      }

      setRegisteringSlot(slotKey);
      try {
        const end = minutesToTime(endMin);
        const res = await fetch('/api/calendar/schedule-block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, date, start, end }),
        });
        if (res.ok) {
          const block = await res.json();
          setRegisteredBlocks((prev) => new Map(prev).set(slotKey, block.id));
        } else {
          toast({ title: 'カレンダー登録に失敗', variant: 'destructive' });
        }
      } finally {
        setRegisteringSlot(null);
      }
    },
    [registeredBlocks, setRegisteredBlocks, setRegisteringSlot],
  );

  return (
    <div className="flex-1 overflow-auto p-4">
      <ScheduleHeader
        loading={loading}
        hasData={!!data}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onRefresh={fetchSchedule}
        totalFreeHours={data?.totalFreeHours}
        unestimatedCount={data?.unestimatedCount}
        editingSettings={editingSettings}
        onSettingsChange={setEditingSettings}
        onSaveSettings={handleSaveSettings}
      />

      {/* 初期状態 */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarClock className="mb-4 h-12 w-12 text-g-border" />
          <p className="text-sm text-g-text-secondary">
            Googleカレンダーの予定を取得し、
            <br />
            タスクの最適なスケジュールを提案します
          </p>
          <p className="mt-2 text-xs text-g-text-muted">
            タスクに「期限」と「見積もり時間」を設定してください
          </p>
        </div>
      )}

      {/* タイムライン */}
      {data && (
        <ScheduleTimeline
          daysData={daysData}
          workStart={savedSettings.workStart}
          workEnd={savedSettings.workEnd}
          draggingTask={draggingTask}
          dropTarget={dropTarget}
          registeredBlocks={registeredBlocks}
          registeringSlot={registeringSlot}
          onDragStartTask={handleDragStartTask}
          onDragStartEvent={handleDragStartEvent}
          onDragEnd={handleDragEnd}
          onDropTargetChange={setDropTarget}
          onDrop={handleDrop}
          onRegisterBlock={handleRegisterBlock}
          onOpenTask={openPanel}
          suggestions={data.suggestions}
        />
      )}

      {/* スケジュール不可タスク */}
      {data && data.unschedulable.length > 0 && (
        <ScheduleUnschedulable items={data.unschedulable} onOpenTask={openPanel} />
      )}

      {/* タスク一覧 */}
      {data && data.suggestions.length > 0 && (
        <ScheduleTaskList
          suggestions={data.suggestions}
          draggingTask={draggingTask}
          onDragStart={handleDragStartTask}
          onDragEnd={handleDragEnd}
          onOpenTask={openPanel}
        />
      )}
    </div>
  );
}
