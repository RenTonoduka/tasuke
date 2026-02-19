'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MoreHorizontal } from 'lucide-react';
import { TaskCard } from './task-card';
import { AddTaskInline } from './add-task-inline';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Section } from '@/types';
import { cn } from '@/lib/utils';

interface BoardColumnProps {
  section: Section;
  onAddTask: (sectionId: string, title: string) => void;
}

export function BoardColumn({ section, onAddTask }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: { type: 'section', sectionId: section.id },
  });

  const taskIds = section.tasks.map((t) => t.id);

  return (
    <div className="flex h-full w-[280px] flex-shrink-0 flex-col rounded-lg bg-[#F8F9FA]">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#202124]">{section.name}</h3>
          <span className="rounded-full bg-[#E8EAED] px-2 py-0.5 text-xs text-[#5F6368]">
            {section.tasks.length}
          </span>
        </div>
        <button className="rounded p-1 text-[#80868B] hover:bg-[#E8EAED]">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Tasks */}
      <ScrollArea className="flex-1 px-2">
        <div
          ref={setNodeRef}
          className={cn(
            'min-h-[40px] space-y-2 pb-2 transition-colors',
            isOver && 'rounded-md bg-[#4285F4]/5'
          )}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {section.tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </SortableContext>
        </div>
      </ScrollArea>

      {/* Add task */}
      <div className="px-2 pb-2">
        <AddTaskInline onAdd={(title) => onAddTask(section.id, title)} />
      </div>
    </div>
  );
}
