// 逆算スケジューリングアルゴリズム

export interface CalendarEvent {
  start: string;
  end: string;
  allDay: boolean;
}

export interface SchedulableTask {
  id: string;
  title: string;
  dueDate: string;
  estimatedHours: number;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

export interface FreeSlot {
  start: Date;
  end: Date;
  hours: number;
}

export interface ScheduledSlot {
  date: string;
  start: string;
  end: string;
  hours: number;
}

export interface TaskSuggestion {
  taskId: string;
  taskTitle: string;
  dueDate: string;
  estimatedHours: number;
  priority: string;
  scheduledSlots: ScheduledSlot[];
  totalScheduledHours: number;
  status: 'schedulable' | 'tight' | 'overdue';
}

export interface UnschedulableTask {
  taskId: string;
  taskTitle: string;
  dueDate: string;
  estimatedHours: number;
  reason: string;
}

export interface ScheduleResult {
  suggestions: TaskSuggestion[];
  unschedulable: UnschedulableTask[];
  totalFreeHours: number;
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function toJSTDate(dateStr: string): Date {
  return new Date(dateStr);
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * カレンダーイベントから空き時間スロットを検出
 */
export function findFreeSlots(
  events: CalendarEvent[],
  startDate: Date,
  endDate: Date,
  workStart: number = 9,
  workEnd: number = 18,
  skipWeekends: boolean = true,
): FreeSlot[] {
  const slots: FreeSlot[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // イベントを時刻付きのみフィルタし、開始時刻でソート
  const timedEvents = events
    .filter((e) => !e.allDay)
    .map((e) => ({ start: toJSTDate(e.start), end: toJSTDate(e.end) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  while (current <= end) {
    if (skipWeekends && isWeekend(current)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const dayStart = new Date(current);
    dayStart.setHours(workStart, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(workEnd, 0, 0, 0);

    // 今日の場合、現在時刻以降のみ対象
    const now = new Date();
    const effectiveStart = dayStart.getTime() < now.getTime() && formatDate(dayStart) === formatDate(now)
      ? new Date(Math.max(dayStart.getTime(), now.getTime()))
      : dayStart;

    // 当日のイベントを取得
    const dayEvents = timedEvents.filter(
      (e) => e.start < dayEnd && e.end > effectiveStart
    );

    let cursor = new Date(effectiveStart);

    for (const event of dayEvents) {
      const eventStart = new Date(Math.max(event.start.getTime(), effectiveStart.getTime()));
      const eventEnd = new Date(Math.min(event.end.getTime(), dayEnd.getTime()));

      if (cursor < eventStart) {
        const hours = (eventStart.getTime() - cursor.getTime()) / (1000 * 60 * 60);
        if (hours >= 0.5) {
          slots.push({ start: new Date(cursor), end: new Date(eventStart), hours: Math.round(hours * 2) / 2 });
        }
      }
      cursor = new Date(Math.max(cursor.getTime(), eventEnd.getTime()));
    }

    if (cursor < dayEnd) {
      const hours = (dayEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60);
      if (hours >= 0.5) {
        slots.push({ start: new Date(cursor), end: new Date(dayEnd), hours: Math.round(hours * 2) / 2 });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return slots;
}

/**
 * Deadline-First Greedy アルゴリズムでスケジュール提案を生成
 */
export function generateScheduleSuggestions(
  tasks: SchedulableTask[],
  freeSlots: FreeSlot[],
): ScheduleResult {
  const now = new Date();
  const suggestions: TaskSuggestion[] = [];
  const unschedulable: UnschedulableTask[] = [];

  // タスクを期限が近い順 → 優先度が高い順でソート
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateCompare = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (dateCompare !== 0) return dateCompare;
    return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
  });

  // 空きスロットのコピー（消費していく）
  const availableSlots = freeSlots.map((s) => ({ ...s, start: new Date(s.start), end: new Date(s.end), hours: s.hours }));

  for (const task of sortedTasks) {
    const dueDate = new Date(task.dueDate);
    const isOverdue = dueDate < now;

    // 期限前の空きスロットのみ対象（overdueの場合は全スロット対象）
    const eligibleSlots = isOverdue
      ? availableSlots.filter((s) => s.hours > 0)
      : availableSlots.filter((s) => s.start < dueDate && s.hours > 0);

    let remainingHours = task.estimatedHours;
    const scheduledSlots: ScheduledSlot[] = [];

    for (const slot of eligibleSlots) {
      if (remainingHours <= 0) break;

      const allocateHours = Math.min(remainingHours, slot.hours);
      const allocateEnd = new Date(slot.start.getTime() + allocateHours * 60 * 60 * 1000);

      scheduledSlots.push({
        date: formatDate(slot.start),
        start: formatTime(slot.start),
        end: formatTime(allocateEnd),
        hours: allocateHours,
      });

      remainingHours -= allocateHours;

      // スロットを消費
      if (allocateHours >= slot.hours) {
        slot.hours = 0;
      } else {
        slot.start = allocateEnd;
        slot.hours -= allocateHours;
      }
    }

    const totalScheduledHours = task.estimatedHours - remainingHours;

    if (remainingHours <= 0) {
      suggestions.push({
        taskId: task.id,
        taskTitle: task.title,
        dueDate: task.dueDate,
        estimatedHours: task.estimatedHours,
        priority: task.priority,
        scheduledSlots,
        totalScheduledHours,
        status: isOverdue ? 'overdue' : 'schedulable',
      });
    } else if (totalScheduledHours > 0) {
      suggestions.push({
        taskId: task.id,
        taskTitle: task.title,
        dueDate: task.dueDate,
        estimatedHours: task.estimatedHours,
        priority: task.priority,
        scheduledSlots,
        totalScheduledHours,
        status: 'tight',
      });
    } else {
      unschedulable.push({
        taskId: task.id,
        taskTitle: task.title,
        dueDate: task.dueDate,
        estimatedHours: task.estimatedHours,
        reason: `期限までの空き時間が不足（必要: ${task.estimatedHours}h, 空き: 0h）`,
      });
    }
  }

  const totalFreeHours = freeSlots.reduce((sum, s) => sum + s.hours, 0);

  return { suggestions, unschedulable, totalFreeHours };
}
