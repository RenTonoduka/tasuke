'use client';

import { CalendarClock, RefreshCw, AlertTriangle, Settings2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { ScheduleSettings } from './schedule-types';

interface ScheduleHeaderProps {
  loading: boolean;
  hasData: boolean;
  showSettings: boolean;
  onToggleSettings: () => void;
  onRefresh: () => void;
  totalFreeHours?: number;
  unestimatedCount?: number;
  editingSettings: ScheduleSettings;
  onSettingsChange: (settings: ScheduleSettings) => void;
  onSaveSettings: () => void;
}

export function ScheduleHeader({
  loading,
  hasData,
  showSettings,
  onToggleSettings,
  onRefresh,
  totalFreeHours,
  unestimatedCount,
  editingSettings,
  onSettingsChange,
  onSaveSettings,
}: ScheduleHeaderProps) {
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
              onChange={(e) =>
                onSettingsChange({ ...editingSettings, workStart: Number(e.target.value) })
              }
              className="rounded border border-g-border px-2 py-1 text-xs"
            >
              {Array.from({ length: 12 }, (_, i) => i + 6).map((h) => (
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
              {Array.from({ length: 12 }, (_, i) => i + 12).map((h) => (
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

      {unestimatedCount !== undefined && unestimatedCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#FBBC04] bg-g-warning-bg px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-[#FBBC04]" />
          <span className="text-xs text-g-text-secondary">
            見積もり時間が未設定のタスクが {unestimatedCount} 件あります。タスクを開いて設定してください。
          </span>
        </div>
      )}
    </>
  );
}
