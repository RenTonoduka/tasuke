import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import type {
  ScheduleData,
  CalendarEvent,
  TaskSuggestion,
  ScheduleSettings,
  DayData,
} from './schedule-types';
import { timeToMinutes, isWeekendDate, formatYMD } from './schedule-types';

const DEFAULT_SETTINGS: ScheduleSettings = { workStart: 9, workEnd: 18, skipWeekends: true };

function loadSettings(key: string): ScheduleSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(`schedule-settings:${key}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_SETTINGS;
}

export function useScheduleData(projectId?: string, myTasksOnly?: boolean) {
  const settingsKey = projectId ?? 'my-tasks';
  const initial = loadSettings(settingsKey);

  // saved = APIリクエストに使う確定設定, editing = UI上の編集中設定
  const [savedSettings, setSavedSettings] = useState<ScheduleSettings>(initial);
  const [editingSettings, setEditingSettings] = useState<ScheduleSettings>(initial);

  const [data, setData] = useState<ScheduleData | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [registeredBlocks, setRegisteredBlocks] = useState<Map<string, string>>(new Map());
  const [registeringSlot, setRegisteringSlot] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchSchedule = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const now = new Date();
      const twoWeeksLater = new Date(now);
      twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

      const [eventsRes, suggestionRes] = await Promise.all([
        fetch(
          `/api/calendar/events?timeMin=${now.toISOString()}&timeMax=${twoWeeksLater.toISOString()}`,
          { signal: controller.signal },
        ),
        fetch('/api/calendar/schedule-suggestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            myTasksOnly,
            workStart: savedSettings.workStart,
            workEnd: savedSettings.workEnd,
            skipWeekends: savedSettings.skipWeekends,
          }),
          signal: controller.signal,
        }),
      ]);

      if (!eventsRes.ok) {
        const err = await eventsRes.json().catch(() => ({}));
        toast({ title: 'カレンダーイベントの取得に失敗', description: err.error, variant: 'destructive' });
      } else {
        setEvents(await eventsRes.json());
      }

      if (!suggestionRes.ok) {
        const err = await suggestionRes.json().catch(() => ({}));
        toast({ title: 'スケジュール提案の取得に失敗', description: err.error, variant: 'destructive' });
      } else {
        const scheduleData: ScheduleData = await suggestionRes.json();
        setData(scheduleData);

        const taskIds = (scheduleData.suggestions ?? []).map((s: TaskSuggestion) => s.taskId).join(',');
        if (taskIds) {
          const blocksRes = await fetch(`/api/calendar/schedule-block?taskIds=${taskIds}`, {
            signal: controller.signal,
          });
          if (blocksRes.ok) {
            const blocks: { taskId: string; date: string; startTime: string; id: string }[] =
              await blocksRes.json();
            const map = new Map<string, string>();
            for (const b of blocks) {
              map.set(`${b.taskId}|${b.date}|${b.startTime}`, b.id);
            }
            setRegisteredBlocks(map);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast({ title: 'スケジュール取得エラー', variant: 'destructive' });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [projectId, myTasksOnly, savedSettings]);

  // unmount時にabort
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // 初回 + savedSettings変更時に自動取得
  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // 設定保存: editing → saved に確定
  const handleSaveSettings = useCallback(() => {
    localStorage.setItem(
      `schedule-settings:${settingsKey}`,
      JSON.stringify(editingSettings),
    );
    setSavedSettings(editingSettings);
    toast({ title: '設定を保存しました' });
  }, [settingsKey, editingSettings]);

  // 今日から14日分の全日付を生成（イベント有無に関係なく）
  const daysData: DayData[] = useMemo(() => {
    const workStartMin = savedSettings.workStart * 60;
    const workEndMin = savedSettings.workEnd * 60;

    const allDates: string[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = formatYMD(d);
      if (savedSettings.skipWeekends && isWeekendDate(dateStr)) continue;
      allDates.push(dateStr);
    }

    const daysMap = new Map<string, DayData>();
    for (const date of allDates) {
      daysMap.set(date, { date, allDayEvents: [], events: [], tasks: [] });
    }

    // イベント配置
    for (const ev of events) {
      const date = ev.start.split('T')[0];
      const day = daysMap.get(date);
      if (!day) continue;

      if (ev.allDay) {
        day.allDayEvents.push(ev.summary);
        continue;
      }

      const startMin = timeToMinutes(ev.start.split('T')[1]?.substring(0, 5) ?? '09:00');
      const endMin = timeToMinutes(ev.end.split('T')[1]?.substring(0, 5) ?? '10:00');
      if (endMin <= workStartMin || startMin >= workEndMin) continue;
      day.events.push({ id: ev.id, summary: ev.summary, startMin, endMin, colorId: ev.colorId });
    }

    // タスクスロット配置
    if (data) {
      for (const sug of data.suggestions) {
        for (const slot of sug.scheduledSlots) {
          const day = daysMap.get(slot.date);
          if (!day) continue;
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
    }

    return allDates.map((date) => daysMap.get(date)!);
  }, [data, events, savedSettings]);

  return {
    data,
    events,
    loading,
    daysData,
    registeredBlocks,
    setRegisteredBlocks,
    registeringSlot,
    setRegisteringSlot,
    savedSettings,
    editingSettings,
    setEditingSettings,
    handleSaveSettings,
    fetchSchedule,
  };
}
