'use client';

import { useMemo, useRef, useEffect } from 'react';
import { startOfDay, addDays, subDays, format, getDay } from 'date-fns';
import { PRIORITY_COLORS } from '@/lib/constants';

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

  // 日付がある（表示可能な）タスクだけフィルタ
  const scheduledTasks = useMemo(
    () => project.tasks.filter((t) => t.startDate || t.dueDate),
    [project.tasks]
  );

  // 初期スクロール: 今日を左寄りに
  useEffect(() => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollLeft = Math.max(0, todayOffset - containerWidth * 0.3);
    }
  }, [todayOffset]);

  // 週の区切り線位置
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

  return (
    <div className="rounded-lg bg-g-bg shadow-sm ring-1 ring-g-border">
      {/* プロジェクトヘッダー */}
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
        <div ref={scrollRef} className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <div
            className="relative"
            style={{
              width: totalDays * DAY_WIDTH,
              height: scheduledTasks.length * ROW_HEIGHT + 24,
            }}
          >
            {/* 週ラベル行 */}
            {weekLines.map((wl) => (
              <span
                key={wl.offset}
                className="absolute top-1 text-[10px] text-g-text-muted"
                style={{ left: wl.offset + 2 }}
              >
                {wl.label}
              </span>
            ))}

            {/* 週区切り線 */}
            {weekLines.map((wl) => (
              <div
                key={`line-${wl.offset}`}
                className="absolute top-0 h-full w-px bg-g-border"
                style={{ left: wl.offset }}
              />
            ))}

            {/* 今日の線 */}
            <div
              className="absolute top-0 z-10 h-full w-0.5 bg-[#EA4335]"
              style={{ left: todayOffset + DAY_WIDTH / 2 }}
            />

            {/* タスクバー */}
            {scheduledTasks.map((task, idx) => (
              <GanttBar
                key={task.id}
                task={task}
                rowIndex={idx}
                rangeStart={rangeStart}
                today={today}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GanttBar({
  task,
  rowIndex,
  rangeStart,
  today,
}: {
  task: GanttTask;
  rowIndex: number;
  rangeStart: Date;
  today: Date;
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
      className="absolute"
      style={{ left, width, top, height: ROW_HEIGHT - 6 }}
      title={task.title}
    >
      <div
        className="h-full rounded-sm px-1.5 flex items-center"
        style={{
          backgroundColor: color,
          opacity: isDone ? 0.35 : 0.85,
        }}
      >
        <span
          className={`truncate text-[10px] text-white leading-none ${isDone ? 'line-through' : ''}`}
        >
          {task.title}
        </span>
      </div>
      {isOverdue && (
        <div className="absolute -right-0.5 top-0 h-full w-1 rounded-r-sm bg-[#EA4335]" />
      )}
    </div>
  );
}
