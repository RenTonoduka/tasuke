'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import type { Task } from '@/types';
import { cn } from '@/lib/utils';

const priorityConfig = {
  P0: { label: 'P0', color: 'bg-[#EA4335] text-white' },
  P1: { label: 'P1', color: 'bg-[#FBBC04] text-g-text' },
  P2: { label: 'P2', color: 'bg-[#4285F4] text-white' },
  P3: { label: 'P3', color: 'bg-g-border text-g-text-secondary' },
};

interface TaskCardProps {
  task: Task;
  overlay?: boolean;
}

export function TaskCard({ task, overlay }: TaskCardProps) {
  const openPanel = useTaskPanelStore((s) => s.open);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const p = priorityConfig[task.priority];

  return (
    <div
      ref={setNodeRef}
      style={overlay ? undefined : style}
      className={cn(
        'group cursor-pointer rounded-lg border border-g-border bg-g-bg p-3 shadow-sm transition-shadow hover:shadow-md',
        isDragging && 'opacity-50',
        overlay && 'rotate-2 shadow-lg'
      )}
      onClick={() => openPanel(task.id)}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 cursor-grab text-[#DADCE0] opacity-0 group-hover:opacity-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm text-g-text',
            task.status === 'DONE' && 'line-through text-g-text-muted'
          )}>
            {task.title}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {task.priority !== 'P3' && (
              <Badge variant="secondary" className={cn('h-5 px-1.5 text-[10px] font-semibold', p.color)}>
                {p.label}
              </Badge>
            )}

            {task.labels.map((tl) => (
              <Badge
                key={tl.id}
                variant="secondary"
                className="h-5 px-1.5 text-[10px]"
                style={{ backgroundColor: tl.label.color + '20', color: tl.label.color }}
              >
                {tl.label.name}
              </Badge>
            ))}

            {task.dueDate && (
              <span className="flex items-center gap-1 text-[10px] text-g-text-secondary">
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
              </span>
            )}

            {task._count.subtasks > 0 && (
              <span className="text-[10px] text-g-text-secondary">
                サブ {task._count.subtasks}
              </span>
            )}
          </div>
        </div>

        {task.assignees.length > 0 && (
          <div className="flex -space-x-1">
            {task.assignees.slice(0, 2).map((a) => (
              <Avatar key={a.id} className="h-5 w-5 border border-white">
                <AvatarImage src={a.user.image ?? ''} />
                <AvatarFallback className="bg-[#4285F4] text-[8px] text-white">
                  {a.user.name?.charAt(0) ?? '?'}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
