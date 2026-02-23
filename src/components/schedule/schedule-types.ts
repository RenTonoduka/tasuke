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

export interface ScheduleData {
  suggestions: TaskSuggestion[];
  unschedulable: UnschedulableTask[];
  totalFreeHours: number;
  unestimatedCount: number;
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
export const DAY_COL_WIDTH = 140;

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

export function isWeekendDate(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function isTodayDate(dateStr: string): boolean {
  const today = new Date();
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

export function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
