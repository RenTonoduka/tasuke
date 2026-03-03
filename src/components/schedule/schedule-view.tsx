'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { CalendarClock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { useScheduleData } from './use-schedule-data';
import { ScheduleHeader } from './schedule-header';
import { ScheduleTimeline } from './schedule-timeline';
import { ScheduleTaskList, ScheduleUnschedulable } from './schedule-task-list';
import { minutesToTime, HOUR_HEIGHT } from './schedule-types';
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
    weekOffset,
    goToPrevWeek,
    goToNextWeek,
    goToToday,
    currentWeekLabel,
  } = useScheduleData(projectId, myTasksOnly);

  const [showSettings, setShowSettings] = useState(false);
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ date: string; startMin: number } | null>(null);
  const droppingRef = useRef(false);
  const openPanel = useTaskPanelStore((s) => s.open);

  // リサイズ
  const [resizing, setResizing] = useState<{
    id: string;
    type: 'event' | 'task';
    initialY: number;
    initialEndMin: number;
    date: string;
    startMin: number;
  } | null>(null);
  const [resizePreviewEndMin, setResizePreviewEndMin] = useState<number | undefined>();

  const workEndMin = savedSettings.workEnd * 60;

  // タイムラインコンテナ（自動スクロール用）
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // 自動スクロール: データ取得後に現在時刻位置へ
  useEffect(() => {
    if (!data || !timelineContainerRef.current || weekOffset !== 0) return;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const workStartMin = savedSettings.workStart * 60;
    if (currentMin < workStartMin) return;

    const offset = ((currentMin - workStartMin) / 60) * HOUR_HEIGHT;
    const container = timelineContainerRef.current;
    const scrollTarget = offset - container.clientHeight / 3;
    requestAnimationFrame(() => {
      container.scrollTop = Math.max(0, scrollTarget);
    });
  }, [data, savedSettings.workStart, weekOffset]);

  // リサイズ: document イベントリスナー
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizing.initialY;
      const deltaMin = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15;
      const newEndMin = Math.max(
        resizing.startMin + 15,
        Math.min(resizing.initialEndMin + deltaMin, workEndMin)
      );
      setResizePreviewEndMin(newEndMin);
    };

    const handleMouseUp = async () => {
      if (resizePreviewEndMin != null && resizePreviewEndMin !== resizing.initialEndMin) {
        const { date, startMin } = resizing;
        const startISO = `${date}T${minutesToTime(startMin)}:00`;
        const endISO = `${date}T${minutesToTime(resizePreviewEndMin)}:00`;

        if (resizing.type === 'event') {
          try {
            await fetch('/api/calendar/events', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventId: resizing.id, start: startISO, end: endISO }),
            });
          } catch { /* ignore */ }
        } else {
          const slotKey = `${resizing.id}|${date}|${minutesToTime(startMin)}`;
          const blockId = registeredBlocks.get(slotKey);
          if (blockId) {
            try {
              await fetch('/api/calendar/schedule-block', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleBlockId: blockId }),
              });
              const res = await fetch('/api/calendar/schedule-block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  taskId: resizing.id,
                  date,
                  start: minutesToTime(startMin),
                  end: minutesToTime(resizePreviewEndMin),
                }),
              });
              if (res.ok) {
                const newBlock = await res.json();
                setRegisteredBlocks((prev) => {
                  const m = new Map(prev);
                  m.delete(slotKey);
                  m.set(slotKey, newBlock.id);
                  return m;
                });
              }
            } catch { /* ignore */ }
          }
        }
        fetchSchedule();
      }
      setResizing(null);
      setResizePreviewEndMin(undefined);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, resizePreviewEndMin, workEndMin, fetchSchedule, registeredBlocks, setRegisteredBlocks]);

  const handleResizeStart = useCallback(
    (id: string, type: 'event' | 'task', clientY: number, endMin: number, date: string, startMin: number) => {
      setResizing({ id, type, initialY: clientY, initialEndMin: endMin, date, startMin });
      setResizePreviewEndMin(endMin);
    },
    [],
  );

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

  // D&D: ドロップ処理
  const handleDrop = useCallback(
    async (e: React.DragEvent, date: string, startMin: number) => {
      e.preventDefault();
      setDropTarget(null);
      setDraggingTask(null);

      if (droppingRef.current) return;
      droppingRef.current = true;

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
        droppingRef.current = false;
        return;
      }

      // Googleカレンダーイベントの移動
      if (payload.calendarEventId) {
        const durationMin = payload.durationMin ?? 60;
        const endMin = Math.min(startMin + durationMin, workEndMin);
        if (endMin <= startMin) { droppingRef.current = false; return; }

        const startISO = `${date}T${minutesToTime(startMin)}:00`;
        const endISO = `${date}T${minutesToTime(endMin)}:00`;

        try {
          const res = await fetch('/api/calendar/events', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: payload.calendarEventId, start: startISO, end: endISO }),
          });
          if (res.ok) {
            fetchSchedule();
          } else {
            const err = await res.json().catch(() => ({}));
            toast({ title: 'カレンダーイベントの移動に失敗', description: err.error, variant: 'destructive' });
          }
        } catch {
          toast({ title: 'カレンダーイベントの移動に失敗', variant: 'destructive' });
        }
        droppingRef.current = false;
        return;
      }

      // タスクの配置/移動
      const { taskId, estimatedHours, fromSlotKey } = payload;
      if (!taskId || !estimatedHours) { droppingRef.current = false; return; }

      const endMin = Math.min(startMin + estimatedHours * 60, workEndMin);
      if (endMin <= startMin) { droppingRef.current = false; return; }

      const start = minutesToTime(startMin);
      const end = minutesToTime(endMin);
      const newSlotKey = `${taskId}|${date}|${start}`;

      if (fromSlotKey && fromSlotKey === newSlotKey) { droppingRef.current = false; return; }
      if (!fromSlotKey && registeredBlocks.has(newSlotKey)) { droppingRef.current = false; return; }

      setRegisteringSlot(newSlotKey);
      try {
        if (fromSlotKey && registeredBlocks.has(fromSlotKey)) {
          const oldBlockId = registeredBlocks.get(fromSlotKey)!;

          const postRes = await fetch('/api/calendar/schedule-block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, date, start, end }),
          });

          if (!postRes.ok) {
            const err = await postRes.json().catch(() => ({}));
            toast({ title: 'ブロックの移動に失敗', description: err.error, variant: 'destructive' });
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
            toast({ title: '旧ブロックの削除に失敗', description: 'カレンダーから手動で削除してください', variant: 'destructive' });
          }

          fetchSchedule();
        } else {
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
            toast({ title: 'ブロックの登録に失敗', description: err.error, variant: 'destructive' });
          }
        }
      } finally {
        setRegisteringSlot(null);
        droppingRef.current = false;
      }
    },
    [workEndMin, registeredBlocks, setRegisteredBlocks, setRegisteringSlot, fetchSchedule],
  );

  // カレンダーイベント削除
  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      try {
        const res = await fetch('/api/calendar/events', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId }),
        });
        if (res.ok) {
          toast({ title: '予定を削除しました' });
          fetchSchedule();
        } else {
          const err = await res.json().catch(() => ({}));
          toast({ title: '予定の削除に失敗', description: err.error, variant: 'destructive' });
        }
      } catch {
        toast({ title: '予定の削除に失敗', variant: 'destructive' });
      }
    },
    [fetchSchedule],
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

  // クリック作成: 空き時間をクリックでGoogleカレンダーに予定を作成
  const handleClickCreate = useCallback(
    async (date: string, startMin: number, endMin: number) => {
      const startISO = `${date}T${minutesToTime(startMin)}:00`;
      const endISO = `${date}T${minutesToTime(endMin)}:00`;
      try {
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: '新しい予定', start: startISO, end: endISO }),
        });
        if (res.ok) {
          toast({ title: '予定を作成しました' });
          fetchSchedule();
        } else {
          const err = await res.json().catch(() => ({}));
          toast({ title: '予定の作成に失敗', description: err.error, variant: 'destructive' });
        }
      } catch {
        toast({ title: '予定の作成に失敗', variant: 'destructive' });
      }
    },
    [fetchSchedule],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 固定ヘッダー */}
      <div className="shrink-0 px-4 pt-4">
        <ScheduleHeader
          loading={loading}
          hasData={!!data}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings(!showSettings)}
          onRefresh={fetchSchedule}
          totalFreeHours={data?.totalFreeHours}
          unestimatedCount={data?.unestimatedCount}
          unestimatedTasks={data?.unestimatedTasks}
          editingSettings={editingSettings}
          onSettingsChange={setEditingSettings}
          onSaveSettings={handleSaveSettings}
          onUpdateEstimate={async (taskId, hours) => {
            try {
              const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estimatedHours: hours }),
              });
              if (res.ok) fetchSchedule();
            } catch { /* ignore */ }
          }}
          onOpenTask={openPanel}
          weekOffset={weekOffset}
          onPrevWeek={goToPrevWeek}
          onNextWeek={goToNextWeek}
          onToday={goToToday}
          weekLabel={currentWeekLabel}
        />
      </div>

      {/* 初期状態 */}
      {!data && !loading && (
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
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

      {/* メインエリア */}
      {data && (
        <div className="flex flex-1 overflow-hidden">
          {/* サイドバー（デスクトップ） */}
          <div className="hidden w-56 shrink-0 overflow-y-auto border-r border-g-border p-3 md:block">
            {data.suggestions.length > 0 && (
              <ScheduleTaskList
                compact
                suggestions={data.suggestions}
                draggingTask={draggingTask}
                onDragStart={handleDragStartTask}
                onDragEnd={handleDragEnd}
                onOpenTask={openPanel}
              />
            )}
            {data.unschedulable.length > 0 && (
              <ScheduleUnschedulable compact items={data.unschedulable} onOpenTask={openPanel} />
            )}
          </div>

          {/* タイムライン */}
          <div ref={timelineContainerRef} className="flex-1 overflow-auto p-2">
            {/* モバイル用: タスクリスト（横長） */}
            <div className="md:hidden">
              {data.suggestions.length > 0 && (
                <ScheduleTaskList
                  suggestions={data.suggestions}
                  draggingTask={draggingTask}
                  onDragStart={handleDragStartTask}
                  onDragEnd={handleDragEnd}
                  onOpenTask={openPanel}
                />
              )}
              {data.unschedulable.length > 0 && (
                <ScheduleUnschedulable items={data.unschedulable} onOpenTask={openPanel} />
              )}
            </div>

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
              onDeleteEvent={handleDeleteEvent}
              onClickCreate={handleClickCreate}
              onResizeStart={handleResizeStart}
              resizingId={resizing?.id}
              resizePreviewEndMin={resizePreviewEndMin}
              suggestions={data.suggestions}
            />
          </div>
        </div>
      )}
    </div>
  );
}
