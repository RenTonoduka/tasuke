'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Calendar, Flag } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { useFilterStore } from '@/stores/filter-store';
import { filterTasks } from '@/lib/task-filters';
import { AddTaskInline } from '@/components/board/add-task-inline';
import type { FilterState } from '@/stores/filter-store';
import type { Section, Task } from '@/types';
import { cn } from '@/lib/utils';

const priorityConfig: Record<string, { label: string; color: string }> = {
  P0: { label: 'P0', color: '#EA4335' },
  P1: { label: 'P1', color: '#FBBC04' },
  P2: { label: 'P2', color: '#4285F4' },
  P3: { label: 'P3', color: '#80868B' },
};

interface ListViewProps {
  sections: Section[];
  projectId: string;
  onAddTask: (sectionId: string, title: string) => void;
  onToggleTask: (taskId: string, currentStatus: string) => void;
}

export function ListView({ sections, projectId, onAddTask, onToggleTask }: ListViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const openPanel = useTaskPanelStore((s) => s.open);

  const { priority, status, assignee, label, dueDateFilter, sortBy, sortOrder } = useFilterStore();
  const filteredSections = useMemo(() => {
    const f: FilterState = { priority, status, assignee, label, dueDateFilter, sortBy, sortOrder };
    return sections.map((s) => ({ ...s, tasks: filterTasks(s.tasks, f) }));
  }, [sections, priority, status, assignee, label, dueDateFilter, sortBy, sortOrder]);

  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex-1 overflow-auto">
      {filteredSections.map((section) => (
        <div key={section.id} className="border-b border-g-border">
          {/* Section header */}
          <button
            onClick={() => toggleSection(section.id)}
            className="flex w-full items-center gap-2 bg-g-surface px-4 py-2 text-left hover:bg-g-surface-hover"
          >
            {collapsed[section.id] ? (
              <ChevronRight className="h-4 w-4 text-g-text-secondary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-g-text-secondary" />
            )}
            <span className="text-sm font-semibold text-g-text">
              {section.name}
            </span>
            <span className="rounded-full bg-g-border px-2 py-0.5 text-xs text-g-text-secondary">
              {section.tasks.length}
            </span>
          </button>

          {/* Task rows */}
          {!collapsed[section.id] && (
            <div>
              {section.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={() => openPanel(task.id)}
                  onToggle={() => onToggleTask(task.id, task.status)}
                />
              ))}
              <div className="px-4 py-1">
                <AddTaskInline onAdd={(title) => onAddTask(section.id, title)} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TaskRow({
  task,
  onOpen,
  onToggle,
}: {
  task: Task;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const p = priorityConfig[task.priority];

  return (
    <div
      className="flex items-center gap-3 border-b border-g-surface-hover px-4 py-2 hover:bg-g-surface cursor-pointer"
      onClick={onOpen}
    >
      <Checkbox
        checked={task.status === 'DONE'}
        onCheckedChange={(e) => {
          e; // prevent propagation handled by onToggle
          onToggle();
        }}
        onClick={(e) => e.stopPropagation()}
      />

      <span
        className={cn(
          'flex-1 truncate text-sm text-g-text',
          task.status === 'DONE' && 'line-through text-g-text-muted'
        )}
      >
        {task.title}
      </span>

      {/* Priority - hidden on mobile */}
      <div className="hidden items-center gap-1 sm:flex">
        <Flag className="h-3 w-3" style={{ color: p.color }} />
        <span className="text-xs text-g-text-secondary">{p.label}</span>
      </div>

      {/* Labels - hidden on mobile */}
      <div className="hidden gap-1 lg:flex">
        {task.labels.slice(0, 2).map((tl) => (
          <Badge
            key={tl.id}
            variant="secondary"
            className="h-5 text-[10px]"
            style={{ backgroundColor: tl.label.color + '20', color: tl.label.color }}
          >
            {tl.label.name}
          </Badge>
        ))}
      </div>

      {/* Due date - hidden on mobile */}
      {task.dueDate && (
        <span className="hidden items-center gap-1 text-xs text-g-text-secondary sm:flex">
          <Calendar className="h-3 w-3" />
          {new Date(task.dueDate).toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )}

      {/* Assignees */}
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
  );
}
