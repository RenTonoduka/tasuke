'use client';

import { Filter, ArrowUpDown, X, Calendar, Users, Tag } from 'lucide-react';
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

const statusOptions = [
  { value: 'TODO', label: '未着手' },
  { value: 'IN_PROGRESS', label: '進行中' },
  { value: 'DONE', label: '完了' },
  { value: 'ARCHIVED', label: 'アーカイブ' },
];

const dueDateOptions = [
  { value: 'all', label: 'すべて' },
  { value: 'overdue', label: '期限超過' },
  { value: 'today', label: '今日' },
  { value: 'this-week', label: '今週' },
  { value: 'no-date', label: '期限なし' },
] as const;

const sortOptions = [
  { value: 'position', label: 'デフォルト' },
  { value: 'created', label: '作成日' },
  { value: 'due', label: '期限' },
  { value: 'priority', label: '優先度' },
  { value: 'title', label: 'タイトル' },
] as const;

export interface FilterBarMember {
  id: string;
  name: string | null;
  image: string | null;
}

export interface FilterBarLabel {
  id: string;
  name: string;
  color: string;
}

interface FilterBarProps {
  members?: FilterBarMember[];
  labels?: FilterBarLabel[];
}

export function FilterBar({ members = [], labels = [] }: FilterBarProps) {
  const {
    priority,
    status,
    assignee,
    label,
    dueDateFilter,
    sortBy,
    setPriority,
    setStatus,
    setAssignee,
    setLabel,
    setDueDateFilter,
    setSortBy,
    reset,
    hasActiveFilters,
  } = useFilterStore();

  const active = hasActiveFilters();
  const filterCount = priority.length + status.length + assignee.length + label.length + (dueDateFilter !== 'all' ? 1 : 0);

  return (
    <div className="flex items-center gap-1.5 border-b border-g-border px-4 py-1.5 overflow-x-auto">
      {/* Priority Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-g-text-secondary shrink-0">
            <Filter className="h-3.5 w-3.5" />
            優先度
            {priority.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                {priority.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
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

      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-g-text-secondary shrink-0">
            ステータス
            {status.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                {status.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {statusOptions.map((s) => (
            <DropdownMenuItem
              key={s.value}
              onClick={() => {
                setStatus(
                  status.includes(s.value)
                    ? status.filter((v) => v !== s.value)
                    : [...status, s.value]
                );
              }}
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={status.includes(s.value)}
                  readOnly
                  className="h-3 w-3"
                />
                {s.label}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Due Date Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-g-text-secondary shrink-0">
            <Calendar className="h-3.5 w-3.5" />
            期限
            {dueDateFilter !== 'all' && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">1</Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {dueDateOptions.map((d) => (
            <DropdownMenuItem
              key={d.value}
              onClick={() => setDueDateFilter(d.value)}
              className={dueDateFilter === d.value ? 'bg-g-surface-hover' : ''}
            >
              {d.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assignee Filter */}
      {members.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-g-text-secondary shrink-0">
              <Users className="h-3.5 w-3.5" />
              担当者
              {assignee.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {assignee.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {members.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => {
                  setAssignee(
                    assignee.includes(m.id)
                      ? assignee.filter((v) => v !== m.id)
                      : [...assignee, m.id]
                  );
                }}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={assignee.includes(m.id)}
                    readOnly
                    className="h-3 w-3"
                  />
                  {m.name ?? 'Unknown'}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Label Filter */}
      {labels.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-g-text-secondary shrink-0">
              <Tag className="h-3.5 w-3.5" />
              ラベル
              {label.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {label.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {labels.map((l) => (
              <DropdownMenuItem
                key={l.id}
                onClick={() => {
                  setLabel(
                    label.includes(l.id)
                      ? label.filter((v) => v !== l.id)
                      : [...label, l.id]
                  );
                }}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={label.includes(l.id)}
                    readOnly
                    className="h-3 w-3"
                  />
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenuSeparator className="h-4 w-px bg-g-border mx-1" />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-g-text-secondary shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5" />
            ソート
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {sortOptions.map((s) => (
            <DropdownMenuItem
              key={s.value}
              onClick={() => setSortBy(s.value)}
              className={sortBy === s.value ? 'bg-g-surface-hover' : ''}
            >
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear */}
      {active && (
        <>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] shrink-0">
            {filterCount}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-[#EA4335] shrink-0"
            onClick={reset}
          >
            <X className="h-3 w-3" />
            クリア
          </Button>
        </>
      )}
    </div>
  );
}
