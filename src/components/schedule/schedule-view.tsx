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

const WORK_HOURS = 9; // 営業時間幅 (9:00-18:00)
const HOUR_WIDTH = 80; // 1時間あたりのピクセル幅

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
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

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      // カレンダーイベントとスケジュール提案を並列取得
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
      events: { summary: string; startMin: number; endMin: number }[];
      tasks: { taskId: string; title: string; priority: string; startMin: number; endMin: number; status: string }[];
    }>();

    // カレンダーイベントを日別に振り分け
    for (const ev of events) {
      if (ev.allDay) continue;
      const date = ev.start.split('T')[0];
      if (!daysMap.has(date)) daysMap.set(date, { events: [], tasks: [] });
      const day = daysMap.get(date)!;
      const startMin = timeToMinutes(ev.start.split('T')[1]?.substring(0, 5) ?? '09:00');
      const endMin = timeToMinutes(ev.end.split('T')[1]?.substring(0, 5) ?? '10:00');
      day.events.push({ summary: ev.summary, startMin, endMin });
    }

    // タスクスロットを日別に振り分け
    for (const sug of data.suggestions) {
      for (const slot of sug.scheduledSlots) {
        if (!daysMap.has(slot.date)) daysMap.set(slot.date, { events: [], tasks: [] });
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
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayData]) => ({ date, ...dayData }));
  };

  const workStartMin = workStart * 60;
  const totalWidth = WORK_HOURS * HOUR_WIDTH;

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
          <span className="text-xs text-[#5F6368]">
            空き時間合計: {data.totalFreeHours}h
          </span>
        )}
      </div>

      {/* 設定パネル */}
      {showSettings && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-[#E8EAED] bg-[#F8F9FA] p-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#5F6368]">営業時間:</label>
            <select
              value={workStart}
              onChange={(e) => setWorkStart(Number(e.target.value))}
              className="rounded border border-[#E8EAED] px-2 py-1 text-xs"
            >
              {Array.from({ length: 12 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
            <span className="text-xs text-[#80868B]">〜</span>
            <select
              value={workEnd}
              onChange={(e) => setWorkEnd(Number(e.target.value))}
              className="rounded border border-[#E8EAED] px-2 py-1 text-xs"
            >
              {Array.from({ length: 12 }, (_, i) => i + 12).map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={skipWeekends} onCheckedChange={setSkipWeekends} />
            <label className="text-xs text-[#5F6368]">土日を除外</label>
          </div>
        </div>
      )}

      {/* 警告: 見積もり未設定 */}
      {data && data.unestimatedCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#FBBC04] bg-[#FEF7E0] px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-[#FBBC04]" />
          <span className="text-xs text-[#5F6368]">
            見積もり時間が未設定のタスクが {data.unestimatedCount} 件あります。タスクを開いて設定してください。
          </span>
        </div>
      )}

      {/* 初期状態 */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarClock className="mb-4 h-12 w-12 text-[#E8EAED]" />
          <p className="text-sm text-[#5F6368]">
            Googleカレンダーの予定を取得し、<br />
            タスクの最適なスケジュールを提案します
          </p>
          <p className="mt-2 text-xs text-[#80868B]">
            タスクに「期限」と「見積もり時間」を設定してください
          </p>
        </div>
      )}

      {/* タイムラインヘッダー */}
      {data && (
        <div className="mb-1 overflow-x-auto">
          <div style={{ minWidth: totalWidth + 100 }}>
            {/* 時刻ヘッダー */}
            <div className="flex">
              <div className="w-[100px] shrink-0" />
              <div className="relative flex" style={{ width: totalWidth }}>
                {Array.from({ length: WORK_HOURS + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-[#80868B]"
                    style={{ position: 'absolute', left: i * HOUR_WIDTH - 10 }}
                  >
                    {workStart + i}:00
                  </div>
                ))}
              </div>
            </div>

            {/* 日別タイムライン */}
            <div className="mt-4 space-y-1">
              {getDaysData().map(({ date, events: dayEvents, tasks: dayTasks }) => (
                <div key={date} className="flex items-center">
                  {/* 日付ラベル */}
                  <div className="w-[100px] shrink-0 pr-2 text-right text-xs font-medium text-[#202124]">
                    {formatDateLabel(date)}
                  </div>
                  {/* タイムラインバー */}
                  <div
                    className="relative h-10 rounded border border-[#E8EAED] bg-white"
                    style={{ width: totalWidth }}
                  >
                    {/* 時刻グリッド線 */}
                    {Array.from({ length: WORK_HOURS }, (_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full border-l border-[#F1F3F4]"
                        style={{ left: (i + 1) * HOUR_WIDTH }}
                      />
                    ))}

                    {/* Googleカレンダー予定（灰色） */}
                    {dayEvents.map((ev, i) => {
                      const left = ((ev.startMin - workStartMin) / 60) * HOUR_WIDTH;
                      const width = ((ev.endMin - ev.startMin) / 60) * HOUR_WIDTH;
                      if (left < 0 || width <= 0) return null;
                      return (
                        <div
                          key={`ev-${i}`}
                          className="absolute top-1 flex items-center overflow-hidden rounded px-1.5 text-[10px] text-[#5F6368]"
                          style={{
                            left: Math.max(0, left),
                            width: Math.min(width, totalWidth - left),
                            height: 32,
                            backgroundColor: '#E8EAED',
                          }}
                          title={ev.summary}
                        >
                          <span className="truncate">{ev.summary}</span>
                        </div>
                      );
                    })}

                    {/* タスクスロット（優先度色） */}
                    {dayTasks.map((task, i) => {
                      const left = ((task.startMin - workStartMin) / 60) * HOUR_WIDTH;
                      const width = ((task.endMin - task.startMin) / 60) * HOUR_WIDTH;
                      if (left < 0 || width <= 0) return null;
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
                            left: Math.max(0, left),
                            width: Math.min(width, totalWidth - left),
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
                </div>
              ))}
            </div>
          </div>
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
                className="flex w-full items-center gap-3 rounded-md border border-[#FCE8E6] bg-[#FEF7E0] px-3 py-2 text-left text-xs hover:bg-[#FCE8E6]"
              >
                <span className="font-medium text-[#202124]">{t.taskTitle}</span>
                <span className="text-[#80868B]">期限: {formatDueDate(t.dueDate)}</span>
                <span className="text-[#EA4335]">{t.reason}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* サマリーカード */}
      {data && data.suggestions.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-[#5F6368]">
            <Clock className="h-3.5 w-3.5" />
            タスク一覧
          </h3>
          <div className="space-y-1">
            {data.suggestions.map((s) => (
              <button
                key={s.taskId}
                onClick={() => openPanel(s.taskId)}
                className="flex w-full items-center gap-3 rounded-md border border-[#E8EAED] px-3 py-2 text-left text-xs hover:bg-[#F8F9FA]"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: PRIORITY_COLORS[s.priority] }}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-[#202124]">
                  {s.taskTitle}
                </span>
                <span className="shrink-0 text-[#80868B]">
                  {s.totalScheduledHours}/{s.estimatedHours}h
                </span>
                <span className="shrink-0 text-[#80868B]">
                  期限: {formatDueDate(s.dueDate)}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    s.status === 'schedulable' && 'bg-[#E6F4EA] text-[#34A853]',
                    s.status === 'tight' && 'bg-[#FEF7E0] text-[#FBBC04]',
                    s.status === 'overdue' && 'bg-[#FCE8E6] text-[#EA4335]'
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
