'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { TaskCard } from './task-card';
import { AddTaskInline } from './add-task-inline';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Section } from '@/types';
import { cn } from '@/lib/utils';

interface SubtaskState {
  expanded: Record<string, boolean>;
  subtasks: Record<string, { id: string; title: string; status: string }[]>;
  loading: Record<string, boolean>;
}

interface BoardColumnProps {
  section: Section;
  onAddTask: (sectionId: string, title: string) => void;
  onRenameSection?: (sectionId: string, name: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  listenNewTask?: boolean;
  subtaskState?: SubtaskState;
  onToggleSubtask?: (taskId: string) => void;
  onToggleSubtaskStatus?: (parentId: string, subtaskId: string, currentStatus: string) => void;
  onDeleteSubtask?: (parentId: string, subtaskId: string) => void;
}

export function BoardColumn({ section, onAddTask, onRenameSection, onDeleteSection, listenNewTask, subtaskState, onToggleSubtask, onToggleSubtaskStatus, onDeleteSubtask }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: { type: 'section', sectionId: section.id },
  });

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(section.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const taskIds = section.tasks.map((t) => t.id);

  const handleRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== section.name) {
      onRenameSection?.(section.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <div className="flex h-full w-[280px] flex-shrink-0 flex-col rounded-lg bg-g-surface">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full rounded border border-[#4285F4] bg-transparent px-1 text-sm font-semibold text-g-text outline-none"
              autoFocus
            />
          ) : (
            <h3 className="text-sm font-semibold text-g-text">{section.name}</h3>
          )}
          <span className="rounded-full bg-g-border px-2 py-0.5 text-xs text-g-text-secondary">
            {section.tasks.length}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-1 text-g-text-muted hover:bg-g-border">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditName(section.name); setEditing(true); }}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              名前を変更
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[#EA4335] focus:text-[#EA4335]"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              <TaskCard
                key={task.id}
                task={task}
                subtaskExpanded={subtaskState?.expanded[task.id]}
                subtaskItems={subtaskState?.subtasks[task.id]}
                subtaskLoading={subtaskState?.loading[task.id]}
                onToggleSubtask={onToggleSubtask ? () => onToggleSubtask(task.id) : undefined}
                onToggleSubtaskStatus={onToggleSubtaskStatus}
                onDeleteSubtask={onDeleteSubtask}
              />
            ))}
          </SortableContext>
        </div>
      </ScrollArea>

      {/* Add task */}
      <div className="px-2 pb-2">
        <AddTaskInline onAdd={(title) => onAddTask(section.id, title)} listenNewTask={listenNewTask} />
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>セクションを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{section.name}」セクションを削除しますか？含まれるタスクも削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#EA4335] hover:bg-red-600"
              onClick={() => onDeleteSection?.(section.id)}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
