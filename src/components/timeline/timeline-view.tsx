'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { subMonths, addMonths, startOfDay, addDays } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { TimelineHeader } from './timeline-header';
import { TimelineRow } from './timeline-row';
import type { Section } from '@/types';

const DAY_WIDTH = 32;
const BEFORE_MONTHS = 2;
const AFTER_MONTHS = 2;

interface TimelineViewProps {
  sections: Section[];
  projectId: string;
}

export function TimelineView({ sections, projectId }: TimelineViewProps) {
  const openPanel = useTaskPanelStore((s) => s.open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

              {/* タスク行（左パネル側は TimelineRow 内で描画するため空行でスペース確保） */}
              {!collapsed[section.id] &&
                section.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="h-10 border-b border-g-border"
                  />
                ))}
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
