'use client';

import { ChevronRight, ChevronDown, X, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface Subtask {
  id: string;
  title: string;
  status: string;
}

interface SubtaskToggleProps {
  count: number;
  doneCount: number;
  expanded: boolean;
  onToggle: () => void;
}

export function SubtaskToggle({ count, doneCount, expanded, onToggle }: SubtaskToggleProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-g-text-secondary hover:bg-g-surface-hover"
      title="サブタスクを展開"
    >
      {expanded ? (
        <ChevronDown className="h-3 w-3" />
      ) : (
        <ChevronRight className="h-3 w-3" />
      )}
      <span>
        {doneCount}/{count}
      </span>
    </button>
  );
}

interface SubtaskListProps {
  subtasks: Subtask[];
  loading?: boolean;
  parentId: string;
  onToggleStatus: (parentId: string, subtaskId: string, currentStatus: string) => void;
  onDelete: (parentId: string, subtaskId: string) => void;
  className?: string;
}

export function SubtaskList({
  subtasks,
  loading,
  parentId,
  onToggleStatus,
  onDelete,
  className,
}: SubtaskListProps) {
  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 py-1.5 pl-9', className)}>
        <Loader2 className="h-3 w-3 animate-spin text-g-text-muted" />
        <span className="text-xs text-g-text-muted">読み込み中...</span>
      </div>
    );
  }

  if (!subtasks || subtasks.length === 0) return null;

  return (
    <div className={cn('space-y-0', className)}>
      {subtasks.map((sub) => (
        <div
          key={sub.id}
          className="group/sub flex items-center gap-2 py-1 pl-9 pr-4 hover:bg-g-surface"
        >
          <Checkbox
            checked={sub.status === 'DONE'}
            onCheckedChange={() => onToggleStatus(parentId, sub.id, sub.status)}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="h-3.5 w-3.5"
          />
          <span
            className={cn(
              'flex-1 truncate text-xs text-g-text-secondary',
              sub.status === 'DONE' && 'line-through text-g-text-muted',
            )}
          >
            {sub.title}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(parentId, sub.id);
            }}
            className="hidden rounded p-0.5 text-g-text-muted hover:bg-g-border hover:text-g-text group-hover/sub:block"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
