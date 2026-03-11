'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { startOfDay, subMonths, addMonths, addDays, subDays, format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PRIORITY_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { TimelineHeader } from '@/components/timeline/timeline-header';

const DAY_WIDTH = 32;
const ROW_HEIGHT = 40;
const BEFORE_MONTHS = 2;
const AFTER_MONTHS = 2;

interface GanttTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
}

interface GanttProject {
  id: string;
  name: string;
  color: string;
  tasks: GanttTask[];
}

interface ProjectGanttProps {
  projects: GanttProject[];
}

export function ProjectGantt({ projects }: ProjectGanttProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const today = useMemo(() => startOfDay(new Date()), []);
  const rangeStart = useMemo(() => startOfDay(subMonths(today, BEFORE_MONTHS)), [today]);
  const rangeEnd = useMemo(() => startOfDay(addMonths(today, AFTER_MONTHS)), [today]);
  const totalDays = useMemo(
    () => Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    [rangeStart, rangeEnd],
  );
  const todayOffset = useMemo(
    () => Math.floor((today.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) * DAY_WIDTH,
    [today, rangeStart],
  );

  // 週末背景
  const weekendBgStyle = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i < totalDays; i++) {
      const day = addDays(rangeStart, i);
      const dow = day.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const l = i * DAY_WIDTH;
      const r = (i + 1) * DAY_WIDTH - 1;
      const bg = isWeekend ? 'var(--g-surface)' : 'transparent';
      stops.push(`${bg} ${l}px`, `${bg} ${r}px`);
    }
    return {
      backgroundImage: [
        `repeating-linear-gradient(to right, transparent 0px, transparent ${DAY_WIDTH - 1}px, var(--g-border) ${DAY_WIDTH - 1}px, var(--g-border) ${DAY_WIDTH}px)`,
        `linear-gradient(to right, ${stops.join(', ')})`,
      ].join(', '),
    };
  }, [totalDays, rangeStart]);

  // 初期スクロール: 今日を中央に
  useEffect(() => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;
      const scrollTarget = todayOffset - containerWidth / 2 + DAY_WIDTH / 2;
      scrollRef.current.scrollLeft = Math.max(0, scrollTarget);
    }
  }, [todayOffset]);

  // 垂直スクロール同期
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

  const toggleProject = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // スケジュール済みタスクがあるプロジェクトのみ
  const activeProjects = useMemo(
    () => projects.filter((p) => p.tasks.some((t) => t.startDate || t.dueDate)),
    [projects],
  );

  if (activeProjects.length === 0) {
    return (
      <div className="rounded-lg bg-g-bg p-5 shadow-sm ring-1 ring-g-border">
        <h2 className="mb-3 text-sm font-semibold text-g-text">タイムライン</h2>
        <div className="flex h-20 items-center justify-center text-sm text-g-text-muted">
          スケジュール設定されたタスクがありません
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-g-bg shadow-sm ring-1 ring-g-border">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 border-b border-g-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-g-text">タイムライン</h2>
        <button
          onClick={scrollToToday}
          className="rounded-md border border-g-border px-3 py-1 text-xs font-medium text-g-text-secondary hover:bg-g-surface-hover"
        >
          今日
        </button>
      </div>

      {/* メインエリア */}
      <div className="flex overflow-hidden" style={{ maxHeight: 480 }}>
        {/* 左パネル */}
        <div
          ref={leftScrollRef}
          onScroll={handleLeftScroll}
          className="hidden w-48 shrink-0 flex-col overflow-y-auto border-r border-g-border md:flex"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* ヘッダー高さ調整 */}
          <div className="h-[60px] shrink-0 border-b border-g-border bg-g-bg" />

          {activeProjects.map((project) => {
            const scheduledTasks = project.tasks.filter((t) => t.startDate || t.dueDate);
            const isCollapsed = collapsed[project.id];
            return (
              <div key={project.id}>
                <button
                  onClick={() => toggleProject(project.id)}
                  className="flex w-full items-center gap-2 border-b border-g-border bg-g-surface px-3 py-2 text-left hover:bg-g-surface-hover"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-g-text-secondary" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-g-text-secondary" />
                  )}
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate text-xs font-semibold text-g-text">
                    {project.name}
                  </span>
                  <span className="ml-auto rounded-full bg-g-border px-1.5 py-0.5 text-[10px] text-g-text-secondary">
                    {scheduledTasks.length}
                  </span>
                </button>
                {!isCollapsed &&
                  scheduledTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center border-b border-g-border px-3"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <span
                        className="mr-2 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#80868B' }}
                      />
                      <span
                        className={cn(
                          'truncate text-sm text-g-text',
                          task.status === 'DONE' && 'text-g-text-muted line-through',
                        )}
                      >
                        {task.title}
                      </span>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>

        {/* 右パネル */}
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
            <TimelineHeader rangeStart={rangeStart} totalDays={totalDays} today={today} />

            {/* 今日の縦線 */}
            <div
              className="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-[#EA4335]"
              style={{ left: todayOffset + DAY_WIDTH / 2 }}
            />

            {/* プロジェクト & タスク行 */}
            {activeProjects.map((project) => {
              const scheduledTasks = project.tasks.filter((t) => t.startDate || t.dueDate);
              const isCollapsed = collapsed[project.id];
              return (
                <div key={project.id}>
                  {/* プロジェクトヘッダー行 */}
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="flex w-full items-center gap-2 border-b border-g-border bg-g-surface px-3 py-2 hover:bg-g-surface-hover"
                    style={{ width: totalDays * DAY_WIDTH }}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-g-text-secondary" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-g-text-secondary" />
                    )}
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="text-xs font-semibold text-g-text">{project.name}</span>
                    <span className="ml-2 rounded-full bg-g-border px-1.5 py-0.5 text-[10px] text-g-text-secondary">
                      {scheduledTasks.length}
                    </span>
                  </button>

                  {/* タスク行 */}
                  {!isCollapsed &&
                    scheduledTasks.map((task) => (
                      <DashboardGanttRow
                        key={task.id}
                        task={task}
                        rangeStart={rangeStart}
                        totalDays={totalDays}
                        today={today}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardGanttRow({
  task,
  rangeStart,
  totalDays,
  today,
}: {
  task: GanttTask;
  rangeStart: Date;
  totalDays: number;
  today: Date;
}) {
  const { left, width, isOverdue } = useMemo(() => {
    const due = task.dueDate ? new Date(task.dueDate) : null;
    const start = task.startDate ? new Date(task.startDate) : null;

    const effectiveStart = start ?? subDays(due!, 3);
    const effectiveEnd = due ?? start!;

    const startOffset = Math.floor(
      (effectiveStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const durationDays = Math.max(
      1,
      Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );

    return {
      left: startOffset * DAY_WIDTH,
      width: durationDays * DAY_WIDTH,
      isOverdue: !!due && due < today && task.status !== 'DONE',
    };
  }, [task, rangeStart, today]);

  const color = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.P3;
  const isDone = task.status === 'DONE';

  return (
    <div
      className="relative border-b border-g-border"
      style={{ height: ROW_HEIGHT, width: totalDays * DAY_WIDTH }}
    >
      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={{ left, width: Math.max(DAY_WIDTH, width) }}
      >
        <div
          className="relative h-6 rounded select-none"
          style={{ backgroundColor: color, opacity: isDone ? 0.4 : 1 }}
          title={task.title}
        >
          <div className="absolute inset-0 flex items-center px-1.5">
            <span
              className={cn(
                'w-full truncate text-[10px] text-white',
                isDone && 'line-through opacity-80',
              )}
            >
              {task.title}
            </span>
          </div>
          {isOverdue && (
            <div className="absolute -right-1 top-0 h-full w-1.5 rounded-r-sm bg-[#EA4335]" />
          )}
        </div>
      </div>
    </div>
  );
}
