'use client';

import { useState } from 'react';
import { CalendarClock, RefreshCw, AlertTriangle, Settings2, Save, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { PRIORITY_COLORS } from './schedule-types';
import type { ScheduleSettings, UnestimatedTask, ViewMode } from './schedule-types';

interface ScheduleHeaderProps {
  loading: boolean;
  hasData: boolean;
  showSettings: boolean;
  onToggleSettings: () => void;
  onRefresh: () => void;
  totalFreeHours?: number;
  unestimatedTasks?: UnestimatedTask[];
  editingSettings: ScheduleSettings;
  onSettingsChange: (settings: ScheduleSettings) => void;
  onSaveSettings: () => void;
  onUpdateEstimate?: (taskId: string, hours: number) => void;
  onOpenTask?: (taskId: string) => void;
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  weekLabel: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
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
  viewMode,
  onViewModeChange,
}: ScheduleHeaderProps) {
  const [showUnestimated, setShowUnestimated] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Today + 週ナビゲーション */}
        <button
          onClick={onToday}
          disabled={loading}
          className={cn(
            'rounded border border-g-border px-2.5 py-0.5 text-xs font-medium transition-colors',
            weekOffset === 0
              ? 'bg-[#1a73e8] text-white border-[#1a73e8]'
              : 'text-g-text-secondary hover:bg-g-surface-hover',
          )}
        >
          今日
        </button>
        <button onClick={onPrevWeek} disabled={loading} className="rounded-full p-1 text-g-text-secondary hover:bg-g-surface-hover transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={onNextWeek} disabled={loading} className="rounded-full p-1 text-g-text-secondary hover:bg-g-surface-hover transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-g-text-secondary">{weekLabel}</span>

        {/* 右側コントロール */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center rounded border border-g-border bg-g-bg p-px">
            {(['day', '3day', 'week'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  viewMode === mode
                    ? 'bg-[#e8f0fe] text-[#1a73e8]'
                    : 'text-g-text-secondary hover:bg-g-surface-hover',
                )}
              >
                {mode === 'day' ? '日' : mode === '3day' ? '3日' : '週'}
              </button>
            ))}
          </div>

          {hasData && totalFreeHours !== undefined && (
            <span className="text-[11px] font-medium text-g-text-secondary bg-g-surface-hover rounded px-2 py-0.5">
              空き{totalFreeHours}h
            </span>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1 rounded bg-[#1a73e8] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#1967d2] transition-all disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5" />
            )}
            {hasData ? '再取得' : '提案'}
          </button>

          <button
            onClick={onToggleSettings}
            className={cn(
              'rounded-full p-1 transition-colors',
              showSettings ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'text-g-text-secondary hover:bg-g-surface-hover',
            )}
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mt-1 flex flex-wrap items-center gap-3 rounded-lg border border-g-border bg-g-bg px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium text-g-text-secondary">営業時間:</label>
            <select
              value={editingSettings.workStart}
              onChange={(e) => {
                const v = Number(e.target.value);
                const newEnd = editingSettings.workEnd <= v ? v + 1 : editingSettings.workEnd;
                onSettingsChange({ ...editingSettings, workStart: v, workEnd: newEnd });
              }}
              className="rounded border border-g-border bg-g-bg px-1.5 py-0.5 text-[11px] text-g-text"
            >
              {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
            <span className="text-[11px] text-g-text-muted">~</span>
            <select
              value={editingSettings.workEnd}
              onChange={(e) =>
                onSettingsChange({ ...editingSettings, workEnd: Number(e.target.value) })
              }
              className="rounded border border-g-border bg-g-bg px-1.5 py-0.5 text-[11px] text-g-text"
            >
              {Array.from({ length: 23 - editingSettings.workStart }, (_, i) => i + editingSettings.workStart + 1).map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch
              checked={editingSettings.skipWeekends}
              onCheckedChange={(v) =>
                onSettingsChange({ ...editingSettings, skipWeekends: v })
              }
            />
            <label className="text-[11px] text-g-text-secondary">土日除外</label>
          </div>
          <Button
            size="sm"
            onClick={onSaveSettings}
            className="ml-auto rounded bg-[#1a73e8] text-white hover:bg-[#1967d2] text-[11px] h-6 px-2.5"
          >
            <Save className="mr-1 h-3 w-3" />
            保存
          </Button>
        </div>
      )}

      {unestimatedTasks && unestimatedTasks.length > 0 ? (
        <div className="mt-1 rounded-lg border border-[#F6BF26]/50 bg-[#FEF7E0]">
          <button
            onClick={() => setShowUnestimated(!showUnestimated)}
            className="flex w-full items-center gap-1.5 px-2.5 py-1 text-left"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#F6BF26]" />
            <span className="flex-1 text-[11px] font-medium text-g-text-secondary">
              設定不足 {unestimatedTasks.length} 件
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-g-text-muted transition-transform', showUnestimated && 'rotate-180')} />
          </button>
          {showUnestimated && (
            <div className="space-y-1.5 border-t border-[#F6BF26]/30 px-3 py-2">
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
                      <span className="rounded-full bg-[#d93025]/10 px-2 py-0.5 text-[10px] font-medium text-[#d93025]">期限未設定</span>
                    )}
                    {t.missingEstimate && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) onUpdateEstimate?.(t.id, parseFloat(e.target.value));
                        }}
                        className="rounded-md border border-g-border bg-g-bg px-2 py-1 text-xs"
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
