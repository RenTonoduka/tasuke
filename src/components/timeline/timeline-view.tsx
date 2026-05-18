'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { subMonths, addMonths, startOfDay, addDays } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { toast } from '@/hooks/use-toast';
import { AddTaskInline } from '@/components/board/add-task-inline';
import { TimelineHeader } from './timeline-header';
import { TimelineRow } from './timeline-row';
import type { Section, Task } from '@/types';

const DAY_WIDTH = 32;
const BEFORE_MONTHS = 2;
const AFTER_MONTHS = 2;
const ADD_TASK_ROW_HEIGHT = 40;

interface TimelineViewProps {
  sections: Section[];
  projectId: string;
}

export function TimelineView({ sections: initialSections, projectId }: TimelineViewProps) {
  const openPanel = useTaskPanelStore((s) => s.open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sections, setSections] = useState<Section[]>(initialSections);
  useEffect(() => { setSections(initialSections); }, [initialSections]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const rangeStart = useMemo(() => startOfDay(subMonths(today, BEFORE_MONTHS)), [today]);
  const rangeEnd = useMemo(() => startOfDay(addMonths(today, AFTER_MONTHS)), [today]);
  const totalDays = useMemo(() => {
    return Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [rangeStart, rangeEnd]);

  const todayOffset = useMemo(() => {
    return Math.floor((today.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
  }, [today, rangeStart]);

  // 週末の背景を1回だけ計算
  const weekendBgStyle = useMemo(() => {
    const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
    const weekendSegments = days
      .map((day, i) => {
        const dow = day.getDay();
        return dow === 0 || dow === 6 ? i : -1;
      })
      .filter((i) => i >= 0);

    // グラデーションストップを生成: 週末セルのみ #F8F9FA
    const stops: string[] = [];
    for (let i = 0; i < totalDays; i++) {
      const isWeekend = weekendSegments.includes(i);
      const left = i * DAY_WIDTH;
      const right = (i + 1) * DAY_WIDTH - 1;
      const bg = isWeekend ? 'var(--g-surface)' : 'transparent';
      stops.push(`${bg} ${left}px`, `${bg} ${right}px`);
    }

    return {
      backgroundImage: [
        // 縦グリッド線
        `repeating-linear-gradient(to right, transparent 0px, transparent ${DAY_WIDTH - 1}px, var(--g-border) ${DAY_WIDTH - 1}px, var(--g-border) ${DAY_WIDTH}px)`,
        // 週末背景
        `linear-gradient(to right, ${stops.join(', ')})`,
      ].join(', '),
    };
  }, [totalDays, rangeStart]);

  // 初期スクロール: 今日を画面中央に
  useEffect(() => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;
      const scrollTarget = todayOffset - containerWidth / 2 + DAY_WIDTH / 2;
      scrollRef.current.scrollLeft = Math.max(0, scrollTarget);
    }
  }, [todayOffset]);

  // 垂直スクロール同期（チャタリング防止）
  const handleRightScroll = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (leftScrollRef.current && scrollRef.current) {
      leftScrollRef.current.scrollTop = scrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, []);

  const handleLeftScroll = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (scrollRef.current && leftScrollRef.current) {
      scrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, []);

  const scrollToToday = useCallback(() => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;
      const scrollTarget = todayOffset - containerWidth / 2 + DAY_WIDTH / 2;
      scrollRef.current.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
    }
  }, [todayOffset]);

  const toggleSection = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleDateChange = useCallback(async (taskId: string, startDate: string | null, dueDate: string | null) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, dueDate }),
      });
    } catch (err) {
      console.error('日付更新エラー:', err);
    }
  }, []);

  const handleAddTask = useCallback(async (
    sectionId: string,
    title: string,
    dates?: { startDate: string; dueDate: string },
  ) => {
    try {
      const body: Record<string, unknown> = { title, sectionId };
      if (dates) {
        body.startDate = dates.startDate;
        body.dueDate = dates.dueDate;
      }
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast({ title: 'タスクの作成に失敗', variant: 'destructive' });
        return;
      }
      const task = (await res.json()) as Task;
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, tasks: [...s.tasks, task] } : s,
        ),
      );
    } catch {
      toast({ title: 'タスクの作成に失敗', variant: 'destructive' });
    }
  }, [projectId]);

  // D&D で範囲指定して新タスクを作成
  const [dragNewTask, setDragNewTask] = useState<{
    sectionId: string;
    startPx: number;
    currentPx: number;
  } | null>(null);
  const dragNewTaskRef = useRef<typeof dragNewTask>(null);
  dragNewTaskRef.current = dragNewTask;
  const [pendingNewTask, setPendingNewTask] = useState<{
    sectionId: string;
    startDayIndex: number;
    endDayIndex: number;
  } | null>(null);
  const [pendingTitle, setPendingTitle] = useState('');

  const handleSpacerPointerDown = useCallback((sectionId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (pendingNewTask) return; // 入力中は新規ドラッグ受付しない
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    setDragNewTask({ sectionId, startPx: x, currentPx: x });
  }, [pendingNewTask]);

  const handleSpacerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragNewTaskRef.current) return;
    // React の SyntheticEvent は setState updater 内では currentTarget が null 化される
    // ため、updater の外で getBoundingClientRect を呼ぶ
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setDragNewTask((prev) => (prev ? { ...prev, currentPx: x } : prev));
  }, []);

  const handleSpacerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    const drag = dragNewTaskRef.current;
    setDragNewTask(null);
    if (!drag) return;
    const minPx = Math.min(drag.startPx, drag.currentPx);
    const maxPx = Math.max(drag.startPx, drag.currentPx);
    // ドラッグ距離が小さすぎる場合（誤クリック）は無視
    if (maxPx - minPx < 4) return;
    const startDayIndex = Math.max(0, Math.min(totalDays - 1, Math.floor(minPx / DAY_WIDTH)));
    const endDayIndex = Math.max(startDayIndex, Math.min(totalDays - 1, Math.floor(maxPx / DAY_WIDTH)));
    setPendingNewTask({ sectionId: drag.sectionId, startDayIndex, endDayIndex });
    setPendingTitle('');
  }, [totalDays]);

  const cancelPendingNewTask = useCallback(() => {
    setPendingNewTask(null);
    setPendingTitle('');
  }, []);

  const submitPendingNewTask = useCallback(async () => {
    if (!pendingNewTask) return;
    const trimmed = pendingTitle.trim();
    if (!trimmed) {
      cancelPendingNewTask();
      return;
    }
    const startDate = addDays(rangeStart, pendingNewTask.startDayIndex).toISOString();
    const dueDate = addDays(rangeStart, pendingNewTask.endDayIndex).toISOString();
    const sectionId = pendingNewTask.sectionId;
    cancelPendingNewTask();
    await handleAddTask(sectionId, trimmed, { startDate, dueDate });
  }, [pendingNewTask, pendingTitle, rangeStart, handleAddTask, cancelPendingNewTask]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 今日ボタン */}
      <div className="flex items-center gap-2 border-b border-g-border bg-g-bg px-4 py-1.5">
        <button
          onClick={scrollToToday}
          className="rounded-md border border-g-border px-3 py-1 text-xs font-medium text-g-text-secondary hover:bg-g-surface-hover"
        >
          今日
        </button>
        <span className="text-xs text-g-text-muted">
          タイムライン表示
        </span>
      </div>

      {/* メインエリア */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左パネル（PCのみ） */}
        <div
          ref={leftScrollRef}
          onScroll={handleLeftScroll}
          className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:border-r md:border-g-border"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* ヘッダー高さ調整スペース (月行 + 日行) */}
          <div className="h-[60px] shrink-0 border-b border-g-border bg-g-bg" />

          {sections.map((section) => (
            <div key={section.id}>
              {/* セクションヘッダー */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center gap-2 bg-g-surface px-3 py-2 text-left hover:bg-g-surface-hover border-b border-g-border"
              >
                {collapsed[section.id] ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-g-text-secondary" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-g-text-secondary" />
                )}
                <span className="truncate text-xs font-semibold text-g-text">
                  {section.name}
                </span>
                <span className="ml-auto rounded-full bg-g-border px-1.5 py-0.5 text-[10px] text-g-text-secondary">
                  {section.tasks.length}
                </span>
              </button>

              {/* タスク行 */}
              {!collapsed[section.id] &&
                section.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center h-10 border-b border-g-border px-3"
                  >
                    <span className="truncate text-sm text-g-text">{task.title}</span>
                  </div>
                ))}

              {/* タスク追加行 */}
              {!collapsed[section.id] && (
                <div
                  className="flex items-center border-b border-g-border px-1"
                  style={{ height: ADD_TASK_ROW_HEIGHT }}
                >
                  <AddTaskInline onAdd={(title) => handleAddTask(section.id, title)} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 右パネル（スクロール可能） */}
        <div
          ref={scrollRef}
          onScroll={handleRightScroll}
          className="flex-1 overflow-auto"
        >
          <div
            className="relative"
            style={{
              width: totalDays * DAY_WIDTH,
              minWidth: '100%',
              ...weekendBgStyle,
            }}
          >
            {/* 日付ヘッダー */}
            <TimelineHeader
              rangeStart={rangeStart}
              totalDays={totalDays}
              today={today}
            />

            {/* 今日の縦線（全行にわたる） */}
            <div
              className="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-[#EA4335]"
              style={{ left: todayOffset + DAY_WIDTH / 2 }}
            />

            {/* セクション & タスク行 */}
            {sections.map((section) => (
              <div key={section.id}>
                {/* セクションヘッダー行 */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center gap-2 border-b border-g-border bg-g-surface px-3 py-2 hover:bg-g-surface-hover"
                  style={{ width: totalDays * DAY_WIDTH }}
                >
                  {collapsed[section.id] ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-g-text-secondary" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-g-text-secondary" />
                  )}
                  <span className="text-xs font-semibold text-g-text">
                    {section.name}
                  </span>
                  <span className="ml-2 rounded-full bg-g-border px-1.5 py-0.5 text-[10px] text-g-text-secondary">
                    {section.tasks.length}
                  </span>
                </button>

                {/* タスク行 */}
                {!collapsed[section.id] &&
                  section.tasks.map((task) => (
                    <TimelineRow
                      key={task.id}
                      task={task}
                      rangeStart={rangeStart}
                      totalDays={totalDays}
                      today={today}
                      onClick={() => openPanel(task.id)}
                      onDateChange={handleDateChange}
                    />
                  ))}

                {/* タスク追加行のスペーサー：D&Dでタスク作成可能
                    md未満では左パネルが非表示なので、左 sticky に AddTaskInline も配置 */}
                {!collapsed[section.id] && (() => {
                  const isDragging = dragNewTask?.sectionId === section.id;
                  const isPending = pendingNewTask?.sectionId === section.id;
                  const ghostLeft = isDragging
                    ? Math.min(dragNewTask!.startPx, dragNewTask!.currentPx)
                    : 0;
                  const ghostWidth = isDragging
                    ? Math.max(2, Math.abs(dragNewTask!.currentPx - dragNewTask!.startPx))
                    : 0;
                  const inputLeft = isPending ? pendingNewTask!.startDayIndex * DAY_WIDTH : 0;
                  const inputWidth = isPending
                    ? Math.max(120, (pendingNewTask!.endDayIndex - pendingNewTask!.startDayIndex + 1) * DAY_WIDTH)
                    : 0;
                  return (
                    <div
                      className="relative border-b border-g-border cursor-crosshair"
                      style={{ height: ADD_TASK_ROW_HEIGHT, width: totalDays * DAY_WIDTH }}
                      onPointerDown={(e) => handleSpacerPointerDown(section.id, e)}
                      onPointerMove={handleSpacerPointerMove}
                      onPointerUp={handleSpacerPointerUp}
                      onPointerCancel={() => setDragNewTask(null)}
                      title="ドラッグしてタスク期間を指定"
                    >
                      {/* ゴーストバー */}
                      {isDragging && (
                        <div
                          className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-6 rounded bg-[#4285F4]/40 ring-2 ring-[#4285F4]"
                          style={{ left: ghostLeft, width: ghostWidth }}
                        />
                      )}
                      {/* タイトル入力 */}
                      {isPending && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-7 rounded bg-g-bg shadow-md ring-2 ring-[#4285F4] flex items-center px-1.5"
                          style={{ left: inputLeft, width: inputWidth }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={pendingTitle}
                            onChange={(e) => setPendingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                submitPendingNewTask();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelPendingNewTask();
                              }
                            }}
                            onBlur={submitPendingNewTask}
                            placeholder="タスク名（Enterで作成）"
                            className="w-full bg-transparent text-xs text-g-text outline-none placeholder:text-g-text-muted"
                          />
                        </div>
                      )}
                      {/* md未満の左 sticky 追加ボタン */}
                      <div
                        className="md:hidden flex h-full w-60 items-center bg-g-bg px-1"
                        style={{ position: 'sticky', left: 0 }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <AddTaskInline onAdd={(title) => handleAddTask(section.id, title)} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
