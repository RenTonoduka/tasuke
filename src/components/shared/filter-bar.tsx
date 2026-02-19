'use client';

import { Filter, ArrowUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useFilterStore } from '@/stores/filter-store';

const priorityOptions = [
  { value: 'P0', label: 'P0 - 緊急' },
  { value: 'P1', label: 'P1 - 高' },
  { value: 'P2', label: 'P2 - 中' },
  { value: 'P3', label: 'P3 - 低' },
];

const sortOptions = [
  { value: 'position', label: 'デフォルト' },
  { value: 'created', label: '作成日' },
  { value: 'due', label: '期限' },
  { value: 'priority', label: '優先度' },
  { value: 'title', label: 'タイトル' },
] as const;

export function FilterBar() {
  const {
    priority,
    sortBy,
    setPriority,
    setSortBy,
    reset,
    hasActiveFilters,
  } = useFilterStore();

  const active = hasActiveFilters();

  return (
    <div className="flex items-center gap-2 border-b border-[#E8EAED] px-4 py-1.5">
      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-[#5F6368]">
            <Filter className="h-3.5 w-3.5" />
            フィルター
            {priority.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {priority.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs">優先度</DropdownMenuLabel>
          {priorityOptions.map((p) => (
            <DropdownMenuItem
              key={p.value}
              onClick={() => {
                setPriority(
                  priority.includes(p.value)
                    ? priority.filter((v) => v !== p.value)
                    : [...priority, p.value]
                );
              }}
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={priority.includes(p.value)}
                  readOnly
                  className="h-3 w-3"
                />
                {p.label}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-[#5F6368]">
            <ArrowUpDown className="h-3.5 w-3.5" />
            ソート
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {sortOptions.map((s) => (
            <DropdownMenuItem
              key={s.value}
              onClick={() => setSortBy(s.value)}
              className={sortBy === s.value ? 'bg-[#F1F3F4]' : ''}
            >
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear */}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-[#EA4335]"
          onClick={reset}
        >
          <X className="h-3 w-3" />
          クリア
        </Button>
      )}
    </div>
  );
}
