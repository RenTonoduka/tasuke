'use client';

import { useState } from 'react';
import { CalendarClock, RefreshCw, AlertTriangle, Settings2, Save, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
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
  // 週ナビゲーション
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  weekLabel: string;
}

export function ScheduleHeader({
  loading,
  hasData,
  showSettings,
  onToggleSettings,
  onRefresh,
  totalFreeHours,
  unestimatedTasks,
  editingSettings,
  onSettingsChange,
  onSaveSettings,
  onUpdateEstimate,
  onOpenTask,
  weekOffset,
  onPrevWeek,
  onNextWeek,
  onToday,
  weekLabel,
}: ScheduleHeaderProps) {
  const [showUnestimated, setShowUnestimated] = useState(false);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* 週ナビゲーション */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrevWeek} disabled={loading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-8 text-xs', weekOffset === 0 && 'bg-[#4285F4] text-white hover:bg-[#3367D6]')}
            onClick={onToday}
            disabled={loading}
          >
            今日
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNextWeek} disabled={loading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1 text-sm font-medium text-g-text">{weekLabel}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={onRefresh}
            disabled={loading}
            size="sm"
            className="bg-[#4285F4] text-white hover:bg-[#3367D6]"
          >
            {loading ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
            )}
            {hasData ? '再取得' : 'スケジュール提案'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSettings}
            className="h-8 text-xs"
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            設定
          </Button>

          {hasData && totalFreeHours !== undefined && (
            <span className="text-xs text-g-text-secondary">
              空き: {totalFreeHours}h
            </span>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-g-border bg-g-surface p-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-g-text-secondary">営業時間:</label>
            <select
              value={editingSettings.workStart}
              onChange={(e) => {
                const v = Number(e.target.value);
                const newEnd = editingSettings.workEnd <= v ? v + 1 : editingSettings.workEnd;
                onSettingsChange({ ...editingSettings, workStart: v, workEnd: newEnd });
              }}
              className="rounded border border-g-border bg-g-bg px-2 py-1 text-xs"
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
              className="rounded border border-g-border bg-g-bg px-2 py-1 text-xs"
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
        <div className="mb-3 rounded-lg border border-[#FBBC04] bg-g-warning-bg">
          <button
            onClick={() => setShowUnestimated(!showUnestimated)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#FBBC04]" />
            <span className="flex-1 text-xs text-g-text-secondary">
              設定不足のタスクが {unestimatedTasks.length} 件
            </span>
            <ChevronDown className={cn('h-4 w-4 text-g-text-muted transition-transform', showUnestimated && 'rotate-180')} />
          </button>
          {showUnestimated && (
            <div className="space-y-1.5 border-t border-[#FBBC04]/30 px-3 py-2">
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
                  <div className="flex shrink-0 items-center gap-1.5">
                    {t.missingDueDate && (
                      <span className="rounded bg-[#EA4335]/10 px-1.5 py-0.5 text-[10px] text-[#EA4335]">期限未設定</span>
                    )}
                    {t.missingEstimate && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) onUpdateEstimate?.(t.id, parseFloat(e.target.value));
                        }}
                        className="rounded border border-g-border bg-g-bg px-2 py-1 text-xs"
                        defaultValue=""
                      >
                        <option value="" disabled>見積もり</option>
                        {[0.5, 1, 1.5, 2, 3, 4, 5, 6, 8].map((h) => (
                          <option key={h} value={h}>{h}h</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
