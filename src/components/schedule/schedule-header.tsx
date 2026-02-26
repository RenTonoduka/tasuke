'use client';

import { useState } from 'react';
import { CalendarClock, RefreshCw, AlertTriangle, Settings2, Save, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { PRIORITY_COLORS } from './schedule-types';
import type { ScheduleSettings, UnestimatedTask } from './schedule-types';

interface ScheduleHeaderProps {
  loading: boolean;
  hasData: boolean;
  showSettings: boolean;
  onToggleSettings: () => void;
  onRefresh: () => void;
  totalFreeHours?: number;
  unestimatedCount?: number;
  unestimatedTasks?: UnestimatedTask[];
  editingSettings: ScheduleSettings;
  onSettingsChange: (settings: ScheduleSettings) => void;
  onSaveSettings: () => void;
  onUpdateEstimate?: (taskId: string, hours: number) => void;
  onOpenTask?: (taskId: string) => void;
}

export function ScheduleHeader({
  loading,
  hasData,
  showSettings,
  onToggleSettings,
  onRefresh,
  totalFreeHours,
  unestimatedCount,
  unestimatedTasks,
  editingSettings,
  onSettingsChange,
  onSaveSettings,
  onUpdateEstimate,
  onOpenTask,
}: ScheduleHeaderProps) {
  const [showUnestimated, setShowUnestimated] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={onRefresh}
          disabled={loading}
          className="bg-[#4285F4] text-white hover:bg-[#3367D6]"
        >
          {loading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CalendarClock className="mr-2 h-4 w-4" />
          )}
          {hasData ? '再取得' : 'スケジュール提案を取得'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleSettings}
          className="text-xs"
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          設定
        </Button>

        {hasData && totalFreeHours !== undefined && (
          <span className="text-xs text-g-text-secondary">
            空き時間合計: {totalFreeHours}h
          </span>
        )}
      </div>

      {showSettings && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-g-border bg-g-surface p-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-g-text-secondary">営業時間:</label>
            <select
              value={editingSettings.workStart}
              onChange={(e) => {
                const v = Number(e.target.value);
                const newEnd = editingSettings.workEnd <= v ? v + 1 : editingSettings.workEnd;
                onSettingsChange({ ...editingSettings, workStart: v, workEnd: newEnd });
              }}
              className="rounded border border-g-border px-2 py-1 text-xs"
            >
              {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
            <span className="text-xs text-g-text-muted">~</span>
            <select
              value={editingSettings.workEnd}
              onChange={(e) =>
                onSettingsChange({ ...editingSettings, workEnd: Number(e.target.value) })
              }
              className="rounded border border-g-border px-2 py-1 text-xs"
            >
              {Array.from({ length: 23 - editingSettings.workStart }, (_, i) => i + editingSettings.workStart + 1).map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={editingSettings.skipWeekends}
              onCheckedChange={(v) =>
                onSettingsChange({ ...editingSettings, skipWeekends: v })
              }
            />
            <label className="text-xs text-g-text-secondary">土日を除外</label>
          </div>
          <Button
            size="sm"
            onClick={onSaveSettings}
            className="ml-auto bg-[#34A853] text-white hover:bg-[#2D9249] text-xs"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            保存
          </Button>
        </div>
      )}

      {unestimatedTasks && unestimatedTasks.length > 0 ? (
        <div className="mb-4 rounded-lg border border-[#FBBC04] bg-g-warning-bg">
          <button
            onClick={() => setShowUnestimated(!showUnestimated)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#FBBC04]" />
            <span className="flex-1 text-xs text-g-text-secondary">
              見積もり時間が未設定のタスクが {unestimatedTasks.length} 件あります
            </span>
            <ChevronDown className={cn('h-4 w-4 text-g-text-muted transition-transform', showUnestimated && 'rotate-180')} />
          </button>
          {showUnestimated && (
            <div className="space-y-1 border-t border-[#FBBC04]/30 px-3 py-2">
              {unestimatedTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLORS[t.priority] ?? '#80868B' }}
                  />
                  <button
                    onClick={() => onOpenTask?.(t.id)}
                    className="min-w-0 flex-1 truncate text-left text-xs text-g-text hover:underline"
                  >
                    {t.title}
                  </button>
                  <select
                    onChange={(e) => {
                      if (e.target.value) onUpdateEstimate?.(t.id, parseFloat(e.target.value));
                    }}
                    className="rounded border border-g-border bg-white px-2 py-1 text-xs"
                    defaultValue=""
                  >
                    <option value="" disabled>時間を設定</option>
                    {[0.5, 1, 1.5, 2, 3, 4, 5, 6, 8].map((h) => (
                      <option key={h} value={h}>{h}h</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : unestimatedCount !== undefined && unestimatedCount > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#FBBC04] bg-g-warning-bg px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-[#FBBC04]" />
          <span className="text-xs text-g-text-secondary">
            見積もり時間が未設定のタスクが {unestimatedCount} 件あります。タスクを開いて設定してください。
          </span>
        </div>
      ) : null}
    </>
  );
}
