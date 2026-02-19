'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar, Flag } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { AddTaskInline } from '@/components/board/add-task-inline';
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

  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex-1 overflow-auto">
      {sections.map((section) => (
        <div key={section.id} className="border-b border-[#E8EAED]">
          {/* Section header */}
          <button
            onClick={() => toggleSection(section.id)}
            className="flex w-full items-center gap-2 bg-[#F8F9FA] px-4 py-2 text-left hover:bg-[#F1F3F4]"
          >
            {collapsed[section.id] ? (
              <ChevronRight className="h-4 w-4 text-[#5F6368]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#5F6368]" />
            )}
            <span className="text-sm font-semibold text-[#202124]">
              {section.name}
            </span>
            <span className="rounded-full bg-[#E8EAED] px-2 py-0.5 text-xs text-[#5F6368]">
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
      className="flex items-center gap-3 border-b border-[#F1F3F4] px-4 py-2 hover:bg-[#F8F9FA] cursor-pointer"
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
          'flex-1 truncate text-sm text-[#202124]',
          task.status === 'DONE' && 'line-through text-[#80868B]'
        )}
      >
        {task.title}
      </span>

      {/* Priority - hidden on mobile */}
      <div className="hidden items-center gap-1 sm:flex">
        <Flag className="h-3 w-3" style={{ color: p.color }} />
        <span className="text-xs text-[#5F6368]">{p.label}</span>
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
        <span className="hidden items-center gap-1 text-xs text-[#5F6368] sm:flex">
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
