'use client';

import { useState, useCallback } from 'react';
import { CalendarClock, RefreshCw, AlertTriangle, Clock, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { cn } from '@/lib/utils';

interface ScheduledSlot {
  date: string;
  start: string;
  end: string;
  hours: number;
}

interface TaskSuggestion {
  taskId: string;
  taskTitle: string;
  dueDate: string;
  estimatedHours: number;
  priority: string;
  scheduledSlots: ScheduledSlot[];
  totalScheduledHours: number;
  status: 'schedulable' | 'tight' | 'overdue';
}

interface UnschedulableTask {
  taskId: string;
  taskTitle: string;
  dueDate: string;
  estimatedHours: number;
  reason: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface ScheduleData {
  suggestions: TaskSuggestion[];
  unschedulable: UnschedulableTask[];
  totalFreeHours: number;
  unestimatedCount: number;
  message?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#EA4335',
  P1: '#FBBC04',
  P2: '#4285F4',
  P3: '#80868B',
};

const HOUR_WIDTH = 80;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function isWeekendDate(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface ScheduleViewProps {
  projectId: string;
}

export function ScheduleView({ projectId }: ScheduleViewProps) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [workStart, setWorkStart] = useState(9);
  const [workEnd, setWorkEnd] = useState(18);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const openPanel = useTaskPanelStore((s) => s.open);

  const workHours = workEnd - workStart;
  const totalWidth = workHours * HOUR_WIDTH;
  const workStartMin = workStart * 60;
  const workEndMin = workEnd * 60;

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const twoWeeksLater = new Date(now);
      twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

      const [eventsRes, suggestionRes] = await Promise.all([
        fetch(`/api/calendar/events?timeMin=${now.toISOString()}&timeMax=${twoWeeksLater.toISOString()}`),
        fetch('/api/calendar/schedule-suggestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, workStart, workEnd, skipWeekends }),
        }),
      ]);

      if (eventsRes.ok) {
        setEvents(await eventsRes.json());
      }
      if (suggestionRes.ok) {
        setData(await suggestionRes.json());
      }
    } catch (err) {
      console.error('スケジュール取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, workStart, workEnd, skipWeekends]);

  // 日ごとにデータを整理
  const getDaysData = () => {
    if (!data) return [];

    const daysMap = new Map<string, {
      allDayEvents: string[];
      events: { summary: string; startMin: number; endMin: number }[];
      tasks: { taskId: string; title: string; priority: string; startMin: number; endMin: number; status: string }[];
    }>();

    for (const ev of events) {
      const date = ev.start.split('T')[0];
      if (!daysMap.has(date)) daysMap.set(date, { allDayEvents: [], events: [], tasks: [] });
      const day = daysMap.get(date)!;

      if (ev.allDay) {
        day.allDayEvents.push(ev.summary);
        continue;
      }

      const startMin = timeToMinutes(ev.start.split('T')[1]?.substring(0, 5) ?? '09:00');
      const endMin = timeToMinutes(ev.end.split('T')[1]?.substring(0, 5) ?? '10:00');
      // 営業時間外のイベントはスキップ
      if (endMin <= workStartMin || startMin >= workEndMin) continue;
      day.events.push({ summary: ev.summary, startMin, endMin });
    }

    for (const sug of data.suggestions) {
      for (const slot of sug.scheduledSlots) {
        if (!daysMap.has(slot.date)) daysMap.set(slot.date, { allDayEvents: [], events: [], tasks: [] });
        const day = daysMap.get(slot.date)!;
        day.tasks.push({
          taskId: sug.taskId,
          title: sug.taskTitle,
          priority: sug.priority,
          startMin: timeToMinutes(slot.start),
          endMin: timeToMinutes(slot.end),
          status: sug.status,
        });
      }
    }

    return Array.from(daysMap.entries())
      .filter(([date]) => !skipWeekends || !isWeekendDate(date))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayData]) => ({ date, ...dayData }));
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* ヘッダー */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={fetchSchedule}
          disabled={loading}
          className="bg-[#4285F4] text-white hover:bg-[#3367D6]"
        >
          {loading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CalendarClock className="mr-2 h-4 w-4" />
          )}
          {data ? '再取得' : 'スケジュール提案を取得'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="text-xs"
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          設定
        </Button>

        {data && (
          <span className="text-xs text-g-text-secondary">
            空き時間合計: {data.totalFreeHours}h
          </span>
        )}
      </div>

      {/* 設定パネル */}
      {showSettings && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-g-border bg-g-surface p-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-g-text-secondary">営業時間:</label>
            <select
              value={workStart}
              onChange={(e) => setWorkStart(Number(e.target.value))}
              className="rounded border border-g-border px-2 py-1 text-xs"
            >
              {Array.from({ length: 12 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
            <span className="text-xs text-g-text-muted">~</span>
            <select
              value={workEnd}
              onChange={(e) => setWorkEnd(Number(e.target.value))}
              className="rounded border border-g-border px-2 py-1 text-xs"
            >
              {Array.from({ length: 12 }, (_, i) => i + 12).map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={skipWeekends} onCheckedChange={setSkipWeekends} />
            <label className="text-xs text-g-text-secondary">土日を除外</label>
          </div>
        </div>
      )}

      {/* 警告: 見積もり未設定 */}
      {data && data.unestimatedCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#FBBC04] bg-g-warning-bg px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-[#FBBC04]" />
          <span className="text-xs text-g-text-secondary">
            見積もり時間が未設定のタスクが {data.unestimatedCount} 件あります。タスクを開いて設定してください。
          </span>
        </div>
      )}

      {/* 初期状態 */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarClock className="mb-4 h-12 w-12 text-g-border" />
          <p className="text-sm text-g-text-secondary">
            Googleカレンダーの予定を取得し、<br />
            タスクの最適なスケジュールを提案します
          </p>
          <p className="mt-2 text-xs text-g-text-muted">
            タスクに「期限」と「見積もり時間」を設定してください
          </p>
        </div>
      )}

      {/* タイムライン */}
      {data && (
        <div className="overflow-x-auto">
          <table className="border-collapse" style={{ minWidth: totalWidth + 120 }}>
            {/* 時刻ヘッダー */}
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[110px] min-w-[110px] bg-g-bg" />
                <th className="p-0">
                  <div className="relative" style={{ width: totalWidth, height: 20 }}>
                    {Array.from({ length: workHours + 1 }, (_, i) => (
                      <span
                        key={i}
                        className="absolute text-[10px] text-g-text-muted"
                        style={{ left: i * HOUR_WIDTH - 10, top: 0 }}
                      >
                        {workStart + i}:00
                      </span>
                    ))}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {getDaysData().map(({ date, allDayEvents, events: dayEvents, tasks: dayTasks }) => (
                <tr key={date}>
                  {/* 日付ラベル（sticky） */}
                  <td className="sticky left-0 z-10 bg-g-bg pr-2 text-right align-middle">
                    <div className="whitespace-nowrap text-xs font-medium text-g-text">
                      {formatDateLabel(date)}
                    </div>
                    {allDayEvents.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {allDayEvents.map((name, i) => (
                          <div key={i} className="truncate text-[9px] text-g-text-muted" style={{ maxWidth: 100 }}>
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* タイムラインバー */}
                  <td className="p-0 py-0.5">
                    <div
                      className="relative rounded border border-g-border bg-g-bg"
                      style={{ width: totalWidth, height: 40 }}
                    >
                      {/* 時刻グリッド線 */}
                      {Array.from({ length: workHours - 1 }, (_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 h-full border-l border-g-surface-hover"
                          style={{ left: (i + 1) * HOUR_WIDTH }}
                        />
                      ))}

                      {/* Googleカレンダー予定（灰色） */}
                      {dayEvents.map((ev, i) => {
                        const clampedStart = Math.max(ev.startMin, workStartMin);
                        const clampedEnd = Math.min(ev.endMin, workEndMin);
                        if (clampedStart >= clampedEnd) return null;
                        const left = ((clampedStart - workStartMin) / 60) * HOUR_WIDTH;
                        const width = ((clampedEnd - clampedStart) / 60) * HOUR_WIDTH;
                        return (
                          <div
                            key={`ev-${i}`}
                            className="absolute top-1 flex items-center overflow-hidden rounded px-1.5 text-[10px] text-g-text-secondary"
                            style={{
                              left,
                              width,
                              height: 32,
                              backgroundColor: 'var(--g-border)',
                            }}
                            title={ev.summary}
                          >
                            <span className="truncate">{ev.summary}</span>
                          </div>
                        );
                      })}

                      {/* タスクスロット（優先度色） */}
                      {dayTasks.map((task, i) => {
                        const clampedStart = Math.max(task.startMin, workStartMin);
                        const clampedEnd = Math.min(task.endMin, workEndMin);
                        if (clampedStart >= clampedEnd) return null;
                        const left = ((clampedStart - workStartMin) / 60) * HOUR_WIDTH;
                        const width = ((clampedEnd - clampedStart) / 60) * HOUR_WIDTH;
                        const color = PRIORITY_COLORS[task.priority] ?? '#4285F4';
                        return (
                          <button
                            key={`task-${i}`}
                            onClick={() => openPanel(task.taskId)}
                            className={cn(
                              'absolute top-1 flex items-center overflow-hidden rounded px-1.5 text-[10px] font-medium text-white transition-opacity hover:opacity-80',
                              task.status === 'tight' && 'border-2 border-dashed border-white'
                            )}
                            style={{
                              left,
                              width,
                              height: 32,
                              backgroundColor: color,
                            }}
                            title={`${task.title} (${task.priority})`}
                          >
                            <span className="truncate">{task.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* スケジュール不可タスク */}
      {data && data.unschedulable.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-[#EA4335]">
            <AlertTriangle className="h-3.5 w-3.5" />
            スケジュール不可（空き時間不足）
          </h3>
          <div className="space-y-1">
            {data.unschedulable.map((t) => (
              <button
                key={t.taskId}
                onClick={() => openPanel(t.taskId)}
                className="flex w-full items-center gap-3 rounded-md border border-[#FCE8E6] bg-g-warning-bg px-3 py-2 text-left text-xs hover:bg-g-error-bg"
              >
                <span className="font-medium text-g-text">{t.taskTitle}</span>
                <span className="text-g-text-muted">期限: {formatDueDate(t.dueDate)}</span>
                <span className="text-[#EA4335]">{t.reason}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* サマリーカード */}
      {data && data.suggestions.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-g-text-secondary">
            <Clock className="h-3.5 w-3.5" />
            タスク一覧
          </h3>
          <div className="space-y-1">
            {data.suggestions.map((s) => (
              <button
                key={s.taskId}
                onClick={() => openPanel(s.taskId)}
                className="flex w-full items-center gap-3 rounded-md border border-g-border px-3 py-2 text-left text-xs hover:bg-g-surface"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: PRIORITY_COLORS[s.priority] }}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-g-text">
                  {s.taskTitle}
                </span>
                <span className="shrink-0 text-g-text-muted">
                  {s.totalScheduledHours}/{s.estimatedHours}h
                </span>
                <span className="shrink-0 text-g-text-muted">
                  期限: {formatDueDate(s.dueDate)}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    s.status === 'schedulable' && 'bg-g-success-bg text-[#34A853]',
                    s.status === 'tight' && 'bg-g-warning-bg text-[#FBBC04]',
                    s.status === 'overdue' && 'bg-g-error-bg text-[#EA4335]'
                  )}
                >
                  {s.status === 'schedulable' ? '配置可能' : s.status === 'tight' ? '時間不足' : '期限超過'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
