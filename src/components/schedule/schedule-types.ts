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

// Google Calendar colorId → 色マッピング (Modern MD3 palette)
export const GCAL_COLORS: Record<string, { bg: string; text: string }> = {
  '1': { bg: '#7986CB', text: '#fff' },   // Lavender
  '2': { bg: '#33B679', text: '#fff' },   // Sage
  '3': { bg: '#8E24AA', text: '#fff' },   // Grape
  '4': { bg: '#E67C73', text: '#fff' },   // Flamingo
  '5': { bg: '#F6BF26', text: '#1d1d1d' }, // Banana
  '6': { bg: '#F4511E', text: '#fff' },   // Tangerine
  '7': { bg: '#039BE5', text: '#fff' },   // Peacock
  '8': { bg: '#616161', text: '#fff' },   // Graphite
  '9': { bg: '#3F51B5', text: '#fff' },   // Blueberry
  '10': { bg: '#0B8043', text: '#fff' },  // Basil
  '11': { bg: '#D50000', text: '#fff' },  // Tomato
};
export const GCAL_DEFAULT_COLOR = { bg: '#039BE5', text: '#fff' };

export const PRIORITY_COLORS: Record<string, string> = {
  P0: '#EA4335',
  P1: '#FBBC04',
  P2: '#4285F4',
  P3: '#80868B',
};

export const HOUR_HEIGHT = 48;
export const MIN_DAY_COL_WIDTH = 140;
export const TIME_LABEL_WIDTH = 56;

// ビューモード
export type ViewMode = 'day' | '3day' | 'week';
export const VIEW_MODE_DAYS: Record<ViewMode, number> = { day: 1, '3day': 3, week: 7 };

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

// --- イベント重複レイアウト計算 (Google Calendar風) ---
export interface OverlapLayoutResult {
  column: number;
  totalColumns: number;
  /** 右方向に広がれるカラム数 (最後のカラムの要素は右側の空きスペースを使える) */
  span: number;
}

export function computeOverlapLayout(items: { startMin: number; endMin: number }[]): OverlapLayoutResult[] {
  const n = items.length;
  if (n === 0) return [];

  const indices = items.map((_, i) => i);
  indices.sort((a, b) => items[a].startMin - items[b].startMin || items[b].endMin - items[a].endMin);

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

  // Google Calendar風: 右側に重なりがなければspanを拡大
  return items.map((_, i) => {
    const totalColumns = (groupMax.get(find(i)) ?? 0) + 1;
    const col = columns[i];
    // 右隣のカラムに同時刻帯の要素があるかチェック
    let span = 1;
    for (let c = col + 1; c < totalColumns; c++) {
      const hasNeighbor = items.some((_, j) =>
        j !== i && columns[j] === c && find(j) === find(i) &&
        items[j].startMin < items[i].endMin && items[j].endMin > items[i].startMin,
      );
      if (hasNeighbor) break;
      span++;
    }
    return { column: col, totalColumns, span };
  });
}
