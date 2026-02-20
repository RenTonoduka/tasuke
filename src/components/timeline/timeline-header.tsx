'use client';

import { useMemo } from 'react';
import { format, addDays, startOfMonth, isSameMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const DAY_WIDTH = 32;

interface TimelineHeaderProps {
  rangeStart: Date;
  totalDays: number;
  today: Date;
}

export function TimelineHeader({ rangeStart, totalDays, today }: TimelineHeaderProps) {
  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  }, [rangeStart, totalDays]);

  const monthGroups = useMemo(() => {
    const groups: { label: string; startIndex: number; span: number }[] = [];
    let current: { label: string; startIndex: number; span: number } | null = null;

    days.forEach((day, i) => {
      const label = format(day, 'yyyy年M月', { locale: ja });
      if (!current || current.label !== label) {
        if (current) groups.push(current);
        current = { label, startIndex: i, span: 1 };
      } else {
        current.span++;
      }
    });
    if (current) groups.push(current);
    return groups;
  }, [days]);

  const todayIndex = useMemo(() => {
    return Math.floor((today.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
  }, [today, rangeStart]);

  return (
    <div className="sticky top-0 z-10 border-b border-g-border bg-g-bg">
      {/* Month row */}
      <div className="flex border-b border-g-border">
        {monthGroups.map((group) => (
          <div
            key={group.label}
            className="border-r border-g-border px-2 py-1 text-xs font-semibold text-g-text-secondary"
            style={{ width: group.span * DAY_WIDTH, minWidth: group.span * DAY_WIDTH }}
          >
            {group.label}
          </div>
        ))}
      </div>

      {/* Day row */}
      <div className="flex">
        {days.map((day, i) => {
          const isToday = i === todayIndex;
          const dow = day.getDay();
          const isWeekend = dow === 0 || dow === 6;
          return (
            <div
              key={i}
              className={cn(
                'flex flex-col items-center justify-center border-r border-g-border py-1 text-[10px]',
                isWeekend && 'bg-g-surface',
                isToday && 'bg-[#E8F0FE]'
              )}
              style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
            >
              <span
                className={cn(
                  'font-medium',
                  isToday ? 'text-[#1A73E8]' : isWeekend ? 'text-g-text-muted' : 'text-g-text-secondary'
                )}
              >
                {format(day, 'd')}
              </span>
              <span
                className={cn(
                  'text-[8px]',
                  isToday ? 'text-[#1A73E8]' : 'text-[#BDBDBD]'
                )}
              >
                {format(day, 'E', { locale: ja })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
