'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { subMonths, addMonths, startOfDay } from 'date-fns';
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

export function TimelineView({ sections }: TimelineViewProps) {
  const openPanel = useTaskPanelStore((s) => s.open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
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

  // 初期スクロール: 今日を画面中央に
  useEffect(() => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;
      const scrollTarget = todayOffset - containerWidth / 2 + DAY_WIDTH / 2;
      scrollRef.current.scrollLeft = Math.max(0, scrollTarget);
    }
  }, [todayOffset]);

  // 垂直スクロール同期
  const handleRightScroll = useCallback(() => {
    if (leftScrollRef.current && scrollRef.current) {
      leftScrollRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  }, []);

  const handleLeftScroll = useCallback(() => {
    if (scrollRef.current && leftScrollRef.current) {
      scrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 今日ボタン */}
      <div className="flex items-center gap-2 border-b border-[#E8EAED] bg-white px-4 py-1.5">
        <button
          onClick={scrollToToday}
          className="rounded-md border border-[#E8EAED] px-3 py-1 text-xs font-medium text-[#5F6368] hover:bg-[#F1F3F4]"
        >
          今日
        </button>
        <span className="text-xs text-[#80868B]">
          タイムライン表示
        </span>
      </div>

      {/* メインエリア */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左パネル（PCのみ） */}
        <div
          ref={leftScrollRef}
          onScroll={handleLeftScroll}
          className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:border-r md:border-[#E8EAED]"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* ヘッダー高さ調整スペース (月行 + 日行) */}
          <div className="h-[60px] shrink-0 border-b border-[#E8EAED] bg-white" />

          {sections.map((section) => (
            <div key={section.id}>
              {/* セクションヘッダー */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center gap-2 bg-[#F8F9FA] px-3 py-2 text-left hover:bg-[#F1F3F4] border-b border-[#E8EAED]"
              >
                {collapsed[section.id] ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#5F6368]" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5F6368]" />
                )}
                <span className="truncate text-xs font-semibold text-[#202124]">
                  {section.name}
                </span>
                <span className="ml-auto rounded-full bg-[#E8EAED] px-1.5 py-0.5 text-[10px] text-[#5F6368]">
                  {section.tasks.length}
                </span>
              </button>

              {/* タスク行（左パネル側は TimelineRow 内で描画するため空行でスペース確保） */}
              {!collapsed[section.id] &&
                section.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="h-10 border-b border-[#E8EAED]"
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
          <div style={{ width: totalDays * DAY_WIDTH, minWidth: '100%' }}>
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
                  className="flex w-full items-center gap-2 border-b border-[#E8EAED] bg-[#F8F9FA] px-3 py-2 hover:bg-[#F1F3F4]"
                  style={{ width: totalDays * DAY_WIDTH }}
                >
                  {collapsed[section.id] ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#5F6368]" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5F6368]" />
                  )}
                  <span className="text-xs font-semibold text-[#202124]">
                    {section.name}
                  </span>
                  <span className="ml-2 rounded-full bg-[#E8EAED] px-1.5 py-0.5 text-[10px] text-[#5F6368]">
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
