'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { CalendarClock, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { useScheduleData } from './use-schedule-data';
import { useScheduleDnd } from './use-schedule-dnd';
import { ScheduleHeader } from './schedule-header';
import { ScheduleTimeline } from './schedule-timeline';
import { ScheduleTaskList, ScheduleUnschedulable } from './schedule-task-list';
import { minutesToTime, HOUR_HEIGHT, GCAL_COLORS, GCAL_DEFAULT_COLOR, PRIORITY_COLORS } from './schedule-types';
import type { ViewMode } from './schedule-types';
import type { ScheduleViewProps } from './schedule-types';

// --- Event creation dialog ---
function EventCreateDialog({
  date,
  startMin,
  endMin,
  onClose,
  onSubmit,
}: {
  date: string;
  startMin: number;
  endMin: number;
  onClose: () => void;
  onSubmit: (summary: string, date: string, startMin: number, endMin: number) => void;
}) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const summary = title.trim() || '新しい予定';
    onSubmit(summary, date, startMin, endMin);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-80 rounded-xl border border-g-border bg-g-bg p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-g-text">予定を作成</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-g-surface-hover">
            <X className="h-4 w-4 text-g-text-muted" />
          </button>
        </div>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="タイトルを入力"
          className="w-full rounded-lg border border-g-border bg-g-surface px-3 py-2 text-sm text-g-text placeholder:text-g-text-muted focus:outline-none focus:ring-2 focus:ring-[#4285F4]"
        />
        <div className="mt-2 flex items-center gap-2 text-xs text-g-text-secondary">
          <span>{date.replace(/-/g, '/')}</span>
          <span>{minutesToTime(startMin)}〜{minutesToTime(endMin)}</span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-g-text-muted hover:bg-g-surface-hover"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-[#4285F4] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#3367D6]"
          >
            作成
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Loading skeleton ---
function TimelineSkeleton({ workStart, workEnd }: { workStart: number; workEnd: number }) {
  const hours = workEnd - workStart;
  return (
    <div className="flex-1 overflow-auto p-2">
      <div className="flex">
        <div className="shrink-0 w-14">
          <div className="h-12" />
          <div className="relative" style={{ height: hours * HOUR_HEIGHT }}>
            {Array.from({ length: hours + 1 }, (_, i) => (
              <div key={i} className="absolute right-2 -translate-y-1/2" style={{ top: i * HOUR_HEIGHT }}>
                <div className="h-3 w-8 rounded bg-g-surface-hover animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }, (_, d) => (
          <div key={d} className="flex-1 border-l border-g-border">
            <div className="h-12 flex items-center justify-center">
              <div className="h-4 w-12 rounded bg-g-surface-hover animate-pulse" />
            </div>
            <div className="relative" style={{ height: hours * HOUR_HEIGHT }}>
              {Array.from({ length: hours }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 w-full border-t border-g-border/40"
                  style={{ top: i * HOUR_HEIGHT }}
                />
              ))}
              {/* Skeleton events */}
              {d < 4 && (
                <>
                  <div
                    className="absolute left-2 right-2 rounded-md bg-g-surface-hover animate-pulse"
                    style={{ top: (1 + d) * HOUR_HEIGHT, height: HOUR_HEIGHT * 1.5 }}
                  />
                  <div
                    className="absolute left-2 right-2 rounded-md bg-g-surface-hover/60 animate-pulse"
                    style={{ top: (4 + d * 0.5) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScheduleView({ projectId, myTasksOnly }: ScheduleViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  // Mobile detection → auto switch to day view
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches && viewMode === 'week') setViewMode('day');
    };
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

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
  } = useScheduleData(projectId, myTasksOnly, viewMode);

  const [showSettings, setShowSettings] = useState(false);
  const openPanel = useTaskPanelStore((s) => s.open);

  // Event creation dialog state
  const [createDialog, setCreateDialog] = useState<{
    date: string;
    startMin: number;
    endMin: number;
  } | null>(null);

  // D&D
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

  // リサイズ: document イベントリスナー
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

  // イベント編集
  const handleEditEvent = useCallback(
    async (eventId: string, summary: string, startMin: number, endMin: number) => {
      try {
        // Find the event date from daysData
        let eventDate = '';
        for (const day of daysData) {
          if (day.events.some((ev) => ev.id === eventId)) {
            eventDate = day.date;
            break;
          }
        }
        if (!eventDate) return;

        const startISO = `${eventDate}T${minutesToTime(startMin)}:00`;
        const endISO = `${eventDate}T${minutesToTime(endMin)}:00`;
        const res = await fetch('/api/calendar/events', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, summary, start: startISO, end: endISO }),
        });
        if (res.ok) {
          toast({ title: '予定を更新しました' });
          fetchSchedule();
        } else {
          const err = await res.json().catch(() => ({}));
          toast({ title: '予定の更新に失敗', description: err.error, variant: 'destructive' });
        }
      } catch {
        toast({ title: '予定の更新に失敗', variant: 'destructive' });
      }
    },
    [fetchSchedule, daysData],
  );

  // ダブルクリック → イベント作成ダイアログ
  const handleClickCreate = useCallback(
    (date: string, startMin: number, endMin: number) => {
      setCreateDialog({ date, startMin, endMin });
    },
    [],
  );

  // イベント作成実行
  const handleCreateEvent = useCallback(
    async (summary: string, date: string, startMin: number, endMin: number) => {
      const startISO = `${date}T${minutesToTime(startMin)}:00`;
      const endISO = `${date}T${minutesToTime(endMin)}:00`;
      try {
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary, start: startISO, end: endISO }),
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

  // DragOverlay content — improved
  const renderDragOverlay = () => {
    if (!activeDragData) return null;
    if (activeDragData.type === 'sidebar-task' || activeDragData.type === 'timeline-task') {
      const color = PRIORITY_COLORS[activeDragData.priority] ?? '#4285F4';
      return (
        <div
          className="rounded-lg px-3 py-2 text-sm font-medium text-white shadow-xl border border-white/20"
          style={{ backgroundColor: color, width: 200, opacity: 0.9 }}
        >
          <span className="line-clamp-1 font-semibold">{activeDragData.taskTitle}</span>
          <span className="block text-xs opacity-70 mt-0.5">{activeDragData.estimatedHours}h · {activeDragData.priority}</span>
        </div>
      );
    }
    const gcalColor = (activeDragData.colorId && GCAL_COLORS[activeDragData.colorId]) || GCAL_DEFAULT_COLOR;
    return (
      <div
        className="rounded-lg border-l-[3px] px-3 py-2 text-sm font-medium shadow-xl"
        style={{
          backgroundColor: `${gcalColor.bg}ee`,
          borderLeftColor: gcalColor.bg,
          color: gcalColor.text,
          width: 200,
        }}
      >
        <span className="line-clamp-1 font-semibold">{activeDragData.summary}</span>
        <span className="block text-xs opacity-70 mt-0.5">{Math.round(activeDragData.durationMin)}分</span>
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
      autoScroll={{ threshold: { x: 0.1, y: 0.15 } }}
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* 固定ヘッダー */}
        <div className="shrink-0 px-4 pt-3 pb-1">
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
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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

        {/* ローディングスケルトン */}
        {loading && !data && (
          <TimelineSkeleton workStart={savedSettings.workStart} workEnd={savedSettings.workEnd} />
        )}

        {/* メインエリア */}
        {data && (
          <div className="flex flex-1 overflow-hidden">
            {/* サイドバー（デスクトップ & 週ビュー） */}
            {viewMode === 'week' && (
              <div className="hidden w-56 shrink-0 overflow-y-auto border-r border-g-border p-3 md:block">
                {data.suggestions.length > 0 && (
                  <ScheduleTaskList compact suggestions={data.suggestions} onOpenTask={openPanel} />
                )}
                {data.unschedulable.length > 0 && (
                  <ScheduleUnschedulable compact items={data.unschedulable} onOpenTask={openPanel} />
                )}
              </div>
            )}

            {/* タイムライン */}
            <div ref={timelineContainerRef} className="flex-1 overflow-auto p-2">
              {/* モバイル / 日ビュー時: タスクリスト */}
              {(viewMode !== 'week') && (
                <div className="mb-2">
                  {data.suggestions.length > 0 && (
                    <ScheduleTaskList suggestions={data.suggestions} onOpenTask={openPanel} />
                  )}
                  {data.unschedulable.length > 0 && (
                    <ScheduleUnschedulable items={data.unschedulable} onOpenTask={openPanel} />
                  )}
                </div>
              )}
              {viewMode === 'week' && (
                <div className="md:hidden mb-2">
                  {data.suggestions.length > 0 && (
                    <ScheduleTaskList suggestions={data.suggestions} onOpenTask={openPanel} />
                  )}
                  {data.unschedulable.length > 0 && (
                    <ScheduleUnschedulable items={data.unschedulable} onOpenTask={openPanel} />
                  )}
                </div>
              )}

              <ScheduleTimeline
                daysData={daysData}
                workStart={savedSettings.workStart}
                workEnd={savedSettings.workEnd}
                registeredBlocks={registeredBlocks}
                registeringSlot={registeringSlot}
                onRegisterBlock={handleRegisterBlock}
                onOpenTask={openPanel}
                onDeleteEvent={handleDeleteEvent}
                onEditEvent={handleEditEvent}
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

      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
        {renderDragOverlay()}
      </DragOverlay>

      {/* イベント作成ダイアログ */}
      {createDialog && (
        <EventCreateDialog
          date={createDialog.date}
          startMin={createDialog.startMin}
          endMin={createDialog.endMin}
          onClose={() => setCreateDialog(null)}
          onSubmit={handleCreateEvent}
        />
      )}
    </DndContext>
  );
}
