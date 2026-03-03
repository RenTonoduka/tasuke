'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { CalendarClock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { useScheduleData } from './use-schedule-data';
import { useScheduleDnd } from './use-schedule-dnd';
import { ScheduleHeader } from './schedule-header';
import { ScheduleTimeline } from './schedule-timeline';
import { ScheduleTaskList, ScheduleUnschedulable } from './schedule-task-list';
import { minutesToTime, HOUR_HEIGHT, GCAL_COLORS, GCAL_DEFAULT_COLOR, PRIORITY_COLORS } from './schedule-types';
import type { ScheduleViewProps } from './schedule-types';

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
  const openPanel = useTaskPanelStore((s) => s.open);

  // D&D (dnd-kit)
  const dayGridRefs = useRef<Map<string, HTMLElement>>(new Map());
  const {
    activeDragData,
    dropIndicator,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  } = useScheduleDnd({
    workStartMin: savedSettings.workStart * 60,
    workEndMin: savedSettings.workEnd * 60,
    registeredBlocks,
    setRegisteredBlocks,
    setRegisteringSlot,
    fetchSchedule,
    dayGridRefs,
  });

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
  const resizeEndMinRef = useRef<number | undefined>();

  const workEndMin = savedSettings.workEnd * 60;
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

  // リサイズ: document イベントリスナー（ref使用で依存配列からresizePreviewEndMinを除外）
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizing.initialY;
      const deltaMin = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15;
      const newEndMin = Math.max(
        resizing.startMin + 15,
        Math.min(resizing.initialEndMin + deltaMin, workEndMin),
      );
      resizeEndMinRef.current = newEndMin;
      setResizePreviewEndMin(newEndMin);
    };

    const handleMouseUp = async () => {
      const finalEndMin = resizeEndMinRef.current;
      if (finalEndMin != null && finalEndMin !== resizing.initialEndMin) {
        const { date, startMin } = resizing;
        const startISO = `${date}T${minutesToTime(startMin)}:00`;
        const endISO = `${date}T${minutesToTime(finalEndMin)}:00`;

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
          const block = registeredBlocks.get(slotKey);
          if (block) {
            try {
              await fetch('/api/calendar/schedule-block', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleBlockId: block.id }),
              });
              const res = await fetch('/api/calendar/schedule-block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  taskId: resizing.id,
                  date,
                  start: minutesToTime(startMin),
                  end: minutesToTime(finalEndMin),
                }),
              });
              if (res.ok) {
                const newBlock = await res.json();
                setRegisteredBlocks((prev) => {
                  const m = new Map(prev);
                  m.delete(slotKey);
                  m.set(slotKey, { id: newBlock.id, endTime: minutesToTime(finalEndMin) });
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
      resizeEndMinRef.current = undefined;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setResizing(null);
        setResizePreviewEndMin(undefined);
        resizeEndMinRef.current = undefined;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [resizing, workEndMin, fetchSchedule, registeredBlocks, setRegisteredBlocks]);

  const handleResizeStart = useCallback(
    (id: string, type: 'event' | 'task', clientY: number, endMin: number, date: string, startMin: number) => {
      setResizing({ id, type, initialY: clientY, initialEndMin: endMin, date, startMin });
      resizeEndMinRef.current = endMin;
      setResizePreviewEndMin(endMin);
    },
    [],
  );

  // カレンダー登録/解除
  const handleRegisterBlock = useCallback(
    async (taskId: string, date: string, startMin: number, endMin: number) => {
      const start = minutesToTime(startMin);
      const slotKey = `${taskId}|${date}|${start}`;

      if (registeredBlocks.has(slotKey)) {
        const block = registeredBlocks.get(slotKey)!;
        setRegisteringSlot(slotKey);
        try {
          const res = await fetch('/api/calendar/schedule-block', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleBlockId: block.id }),
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
          setRegisteredBlocks((prev) => new Map(prev).set(slotKey, { id: block.id, endTime: end }));
        } else {
          toast({ title: 'カレンダー登録に失敗', variant: 'destructive' });
        }
      } finally {
        setRegisteringSlot(null);
      }
    },
    [registeredBlocks, setRegisteredBlocks, setRegisteringSlot],
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

  // ダブルクリック → イベント作成
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

  // DragOverlay content
  const renderDragOverlay = () => {
    if (!activeDragData) return null;
    if (activeDragData.type === 'sidebar-task' || activeDragData.type === 'timeline-task') {
      const color = PRIORITY_COLORS[activeDragData.priority] ?? '#4285F4';
      return (
        <div
          className="rounded-md px-2 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ backgroundColor: color, width: 160 }}
        >
          <span className="line-clamp-1">{activeDragData.taskTitle}</span>
          <span className="block text-[10px] opacity-70">{activeDragData.estimatedHours}h</span>
        </div>
      );
    }
    const gcalColor = (activeDragData.colorId && GCAL_COLORS[activeDragData.colorId]) || GCAL_DEFAULT_COLOR;
    return (
      <div
        className="rounded-md px-2 py-1.5 text-xs font-medium shadow-lg"
        style={{ backgroundColor: gcalColor.bg, color: gcalColor.text, width: 160 }}
      >
        <span className="line-clamp-1">{activeDragData.summary}</span>
        <span className="block text-[10px] opacity-70">{Math.round(activeDragData.durationMin)}分</span>
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      autoScroll={{ threshold: { x: 0, y: 0.15 } }}
    >
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
                <ScheduleTaskList compact suggestions={data.suggestions} onOpenTask={openPanel} />
              )}
              {data.unschedulable.length > 0 && (
                <ScheduleUnschedulable compact items={data.unschedulable} onOpenTask={openPanel} />
              )}
            </div>

            {/* タイムライン */}
            <div ref={timelineContainerRef} className="flex-1 overflow-auto p-2">
              {/* モバイル用: タスクリスト */}
              <div className="md:hidden">
                {data.suggestions.length > 0 && (
                  <ScheduleTaskList suggestions={data.suggestions} onOpenTask={openPanel} />
                )}
                {data.unschedulable.length > 0 && (
                  <ScheduleUnschedulable items={data.unschedulable} onOpenTask={openPanel} />
                )}
              </div>

              <ScheduleTimeline
                daysData={daysData}
                workStart={savedSettings.workStart}
                workEnd={savedSettings.workEnd}
                registeredBlocks={registeredBlocks}
                registeringSlot={registeringSlot}
                onRegisterBlock={handleRegisterBlock}
                onOpenTask={openPanel}
                onDeleteEvent={handleDeleteEvent}
                onClickCreate={handleClickCreate}
                onResizeStart={handleResizeStart}
                resizingId={resizing?.id}
                resizePreviewEndMin={resizePreviewEndMin}
                dropIndicator={dropIndicator}
                dayGridRefs={dayGridRefs}
              />
            </div>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {renderDragOverlay()}
      </DragOverlay>
    </DndContext>
  );
}
