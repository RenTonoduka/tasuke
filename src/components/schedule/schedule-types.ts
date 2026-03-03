// スケジュールビュー共通の型・定数・ユーティリティ

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

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  colorId: string | null;
}

export interface UnestimatedTask {
  id: string;
  title: string;
  priority: string;
  dueDate: string;
  missingDueDate?: boolean;
  missingEstimate?: boolean;
}

export interface ScheduleData {
  suggestions: TaskSuggestion[];
  unschedulable: UnschedulableTask[];
  totalFreeHours: number;
  unestimatedCount: number;
  unestimatedTasks?: UnestimatedTask[];
  message?: string;
}

export interface DayEvent {
  id: string;
  summary: string;
  startMin: number;
  endMin: number;
  colorId: string | null;
}

export interface DayTask {
  taskId: string;
  title: string;
  priority: string;
  startMin: number;
  endMin: number;
  status: string;
}

export interface DayData {
  date: string;
  allDayEvents: string[];
  events: DayEvent[];
  tasks: DayTask[];
}

export interface ScheduleSettings {
  workStart: number;
  workEnd: number;
  skipWeekends: boolean;
}

export interface ScheduleViewProps {
  projectId?: string;
  myTasksOnly?: boolean;
}

// Google Calendar colorId → 色マッピング
export const GCAL_COLORS: Record<string, { bg: string; text: string }> = {
  '1': { bg: '#a4bdfc', text: '#1d1d1d' },
  '2': { bg: '#7ae7bf', text: '#1d1d1d' },
  '3': { bg: '#dbadff', text: '#1d1d1d' },
  '4': { bg: '#ff887c', text: '#fff' },
  '5': { bg: '#fbd75b', text: '#1d1d1d' },
  '6': { bg: '#ffb878', text: '#1d1d1d' },
  '7': { bg: '#46d6db', text: '#1d1d1d' },
  '8': { bg: '#e1e1e1', text: '#1d1d1d' },
  '9': { bg: '#5484ed', text: '#fff' },
  '10': { bg: '#51b749', text: '#fff' },
  '11': { bg: '#dc2127', text: '#fff' },
};
export const GCAL_DEFAULT_COLOR = { bg: '#4285F4', text: '#fff' };

export const PRIORITY_COLORS: Record<string, string> = {
  P0: '#EA4335',
  P1: '#FBBC04',
  P2: '#4285F4',
  P3: '#80868B',
};

export const HOUR_HEIGHT = 60;
export const MIN_DAY_COL_WIDTH = 180;
export const TIME_LABEL_WIDTH = 52;

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// タイムゾーン安全な日付パース（"YYYY-MM-DD" → ローカル Date）
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

export function isWeekendDate(dateStr: string): boolean {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function isTodayDate(dateStr: string): boolean {
  const today = new Date();
  const d = parseLocalDate(dateStr);
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

export function formatDueDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- D&D 型定義 ---

export interface SidebarTaskDragData {
  type: 'sidebar-task';
  taskId: string;
  taskTitle: string;
  estimatedHours: number;
  priority: string;
}

export interface TimelineTaskDragData {
  type: 'timeline-task';
  taskId: string;
  taskTitle: string;
  estimatedHours: number;
  priority: string;
  fromSlotKey?: string;
}

export interface TimelineEventDragData {
  type: 'timeline-event';
  calendarEventId: string;
  summary: string;
  durationMin: number;
  colorId: string | null;
}

export type ScheduleDragData = SidebarTaskDragData | TimelineTaskDragData | TimelineEventDragData;

export interface DropIndicator {
  date: string;
  startMin: number;
  endMin: number;
}

// 登録済みブロック情報
export interface RegisteredBlock {
  id: string;
  endTime: string;
}

// --- イベント重複レイアウト計算 ---
export interface OverlapLayoutResult {
  column: number;
  totalColumns: number;
}

export function computeOverlapLayout(items: { startMin: number; endMin: number }[]): OverlapLayoutResult[] {
  const n = items.length;
  if (n === 0) return [];

  const indices = items.map((_, i) => i);
  indices.sort((a, b) => items[a].startMin - items[b].startMin || items[a].endMin - items[b].endMin);

  const columns = new Array<number>(n).fill(0);

  for (let ii = 0; ii < n; ii++) {
    const i = indices[ii];
    const used = new Set<number>();
    for (let jj = 0; jj < ii; jj++) {
      const j = indices[jj];
      if (items[j].endMin > items[i].startMin) {
        used.add(columns[j]);
      }
    }
    let col = 0;
    while (used.has(col)) col++;
    columns[i] = col;
  }

  // Union-Find で重複グループを求める
  const parent = indices.map((_, i) => i);
  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  for (let ii = 0; ii < n; ii++) {
    for (let jj = ii + 1; jj < n; jj++) {
      const i = indices[ii], j = indices[jj];
      if (items[j].startMin < items[i].endMin) {
        parent[find(i)] = find(j);
      }
    }
  }

  const groupMax = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    groupMax.set(root, Math.max(groupMax.get(root) ?? 0, columns[i]));
  }

  return items.map((_, i) => ({
    column: columns[i],
    totalColumns: (groupMax.get(find(i)) ?? 0) + 1,
  }));
}
