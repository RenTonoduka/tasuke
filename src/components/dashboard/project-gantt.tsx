'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { startOfDay, addDays, subDays, format, getDay } from 'date-fns';
import { Pin, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { PRIORITY_COLORS } from '@/lib/constants';
import { useGanttPins } from '@/hooks/use-gantt-pins';

const DAY_WIDTH = 20;
const ROW_HEIGHT = 24;
const BEFORE_DAYS = 14;
const AFTER_DAYS = 28;

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
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-g-text">プロジェクト別ガントチャート</h2>
      {projects.length === 0 ? (
        <div className="rounded-lg bg-g-bg p-5 shadow-sm ring-1 ring-g-border">
          <div className="flex h-20 items-center justify-center text-sm text-g-text-muted">
            プロジェクトがありません
          </div>
        </div>
      ) : (
        projects.map((project) => (
          <MiniGantt key={project.id} project={project} />
        ))
      )}
    </div>
  );
}

function MiniGantt({ project }: { project: GanttProject }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => startOfDay(new Date()), []);
  const rangeStart = useMemo(() => subDays(today, BEFORE_DAYS), [today]);
  const totalDays = BEFORE_DAYS + AFTER_DAYS + 1;
  const todayOffset = useMemo(() => BEFORE_DAYS * DAY_WIDTH, []);
  const { togglePin, getState, getPinnedIds, getHiddenIds } = useGanttPins(project.id);
  const [showHidden, setShowHidden] = useState(false);

  const scheduledTasks = useMemo(
    () => project.tasks.filter((t) => t.startDate || t.dueDate),
    [project.tasks]
  );

  const pinnedIds = getPinnedIds();
  const hiddenIds = getHiddenIds();

  const { pinnedTasks, normalTasks, hiddenTasks } = useMemo(() => {
    const pinned: GanttTask[] = [];
    const normal: GanttTask[] = [];
    const hidden: GanttTask[] = [];
    for (const t of scheduledTasks) {
      if (pinnedIds.has(t.id)) pinned.push(t);
      else if (hiddenIds.has(t.id)) hidden.push(t);
      else normal.push(t);
    }
    return { pinnedTasks: pinned, normalTasks: normal, hiddenTasks: hidden };
  }, [scheduledTasks, pinnedIds, hiddenIds]);

  const visibleTasks = useMemo(() => {
    return [...pinnedTasks, ...normalTasks];
  }, [pinnedTasks, normalTasks]);

  const allDisplayTasks = useMemo(() => {
    return showHidden ? [...visibleTasks, ...hiddenTasks] : visibleTasks;
  }, [visibleTasks, hiddenTasks, showHidden]);

  useEffect(() => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollLeft = Math.max(0, todayOffset - containerWidth * 0.3);
    }
  }, [todayOffset]);

  const weekLines = useMemo(() => {
    const lines: { offset: number; label: string }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const day = addDays(rangeStart, i);
      if (getDay(day) === 1) {
        lines.push({ offset: i * DAY_WIDTH, label: format(day, 'M/d') });
      }
    }
    return lines;
  }, [rangeStart, totalDays]);

  const pinnedCount = pinnedTasks.length;

  return (
    <div className="rounded-lg bg-g-bg shadow-sm ring-1 ring-g-border">
      <div className="flex items-center gap-2 border-b border-g-border px-4 py-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        <span className="text-sm font-medium text-g-text">{project.name}</span>
        <span className="ml-auto text-xs text-g-text-muted">
          {scheduledTasks.length}件
        </span>
      </div>

      {scheduledTasks.length === 0 ? (
        <div className="flex h-16 items-center justify-center text-xs text-g-text-muted">
          スケジュール未設定
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
            <div
              className="relative"
              style={{
                width: totalDays * DAY_WIDTH,
                height: allDisplayTasks.length * ROW_HEIGHT + 24,
              }}
            >
              {weekLines.map((wl) => (
                <span
                  key={wl.offset}
                  className="absolute top-1 text-[10px] text-g-text-muted"
                  style={{ left: wl.offset + 2 }}
                >
                  {wl.label}
                </span>
              ))}

              {weekLines.map((wl) => (
                <div
                  key={`line-${wl.offset}`}
                  className="absolute top-0 h-full w-px bg-g-border"
                  style={{ left: wl.offset }}
                />
              ))}

              <div
                className="absolute top-0 z-10 h-full w-0.5 bg-[#EA4335]"
                style={{ left: todayOffset + DAY_WIDTH / 2 }}
              />

              {/* Pinned separator line */}
              {pinnedCount > 0 && normalTasks.length > 0 && (
                <div
                  className="absolute left-0 w-full border-b border-dashed border-[#4285F4]/30"
                  style={{ top: 24 + pinnedCount * ROW_HEIGHT }}
                />
              )}

              {allDisplayTasks.map((task, idx) => {
                const state = getState(task.id);
                const isInHiddenSection = hiddenIds.has(task.id);
                return (
                  <GanttBar
                    key={task.id}
                    task={task}
                    rowIndex={idx}
                    rangeStart={rangeStart}
                    today={today}
                    pinState={state}
                    dimmed={isInHiddenSection}
                    onTogglePin={() => togglePin(task.id)}
                  />
                );
              })}
            </div>
          </div>

          {/* Hidden tasks toggle */}
          {hiddenTasks.length > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="flex w-full items-center gap-1.5 border-t border-g-border px-4 py-1.5 text-xs text-g-text-muted hover:bg-g-surface-hover"
            >
              {showHidden ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <EyeOff className="h-3 w-3" />
              非表示 ({hiddenTasks.length}件)
            </button>
          )}
        </>
      )}
    </div>
  );
}

function GanttBar({
  task,
  rowIndex,
  rangeStart,
  today,
  pinState,
  dimmed,
  onTogglePin,
}: {
  task: GanttTask;
  rowIndex: number;
  rangeStart: Date;
  today: Date;
  pinState?: 'pinned' | 'hidden';
  dimmed?: boolean;
  onTogglePin: () => void;
}) {
  const { left, width, isOverdue } = useMemo(() => {
    const due = task.dueDate ? new Date(task.dueDate) : null;
    const start = task.startDate ? new Date(task.startDate) : null;

    const effectiveStart = start ?? subDays(due!, 3);
    const effectiveEnd = due ?? start!;

    const startOffset = Math.floor(
      (effectiveStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const durationDays = Math.max(
      1,
      Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    return {
      left: startOffset * DAY_WIDTH,
      width: durationDays * DAY_WIDTH,
      isOverdue: !!due && due < today && task.status !== 'DONE',
    };
  }, [task, rangeStart, today]);

  const color = PRIORITY_COLORS[task.priority] ?? '#4285F4';
  const isDone = task.status === 'DONE';
  const top = 24 + rowIndex * ROW_HEIGHT + 3;

  return (
    <div
      className="group/bar absolute flex items-center"
      style={{ left: 0, width: '100%', top, height: ROW_HEIGHT - 6 }}
    >
      {/* Pin toggle button */}
      <button
        onClick={onTogglePin}
        className="absolute -left-0 z-20 flex h-4 w-4 items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity"
        style={{ left: Math.max(0, left - 18) }}
        title={
          pinState === 'pinned' ? '非表示にする' :
          pinState === 'hidden' ? '通常に戻す' :
          'ピン留めする'
        }
      >
        {pinState === 'hidden' ? (
          <EyeOff className="h-3 w-3 text-g-text-muted" />
        ) : (
          <Pin
            className={`h-3 w-3 ${pinState === 'pinned' ? 'text-[#4285F4] fill-[#4285F4]' : 'text-g-text-muted'}`}
          />
        )}
      </button>

      {/* Task bar */}
      <div
        className="absolute"
        style={{ left, width, top: 0, height: ROW_HEIGHT - 6 }}
      >
        <div
          className="h-full rounded-sm px-1.5 flex items-center"
          style={{
            backgroundColor: color,
            opacity: dimmed ? 0.2 : isDone ? 0.35 : 0.85,
          }}
        >
          <span
            className={`truncate text-[10px] text-white leading-none ${isDone ? 'line-through' : ''}`}
          >
            {task.title}
          </span>
        </div>
        {isOverdue && !dimmed && (
          <div className="absolute -right-0.5 top-0 h-full w-1 rounded-r-sm bg-[#EA4335]" />
        )}
      </div>

      {/* Always-visible pin indicator */}
      {pinState === 'pinned' && (
        <Pin
          className="absolute z-20 h-2.5 w-2.5 text-[#4285F4] fill-[#4285F4] group-hover/bar:hidden"
          style={{ left: Math.max(0, left - 14) }}
        />
      )}
    </div>
  );
}
