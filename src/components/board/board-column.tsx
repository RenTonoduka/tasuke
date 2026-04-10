'use client';

import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Pencil, Trash2, GripVertical, Check } from 'lucide-react';
import { TaskCard } from './task-card';
import { AddTaskInline } from './add-task-inline';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import type { Section, TaskStatusValue } from '@/types';
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
  onUpdateSection?: (
    sectionId: string,
    data: { color?: string | null; statusMapping?: TaskStatusValue | null },
  ) => void;
  listenNewTask?: boolean;
  subtaskState?: SubtaskState;
  onToggleSubtask?: (taskId: string) => void;
  onToggleSubtaskStatus?: (parentId: string, subtaskId: string, currentStatus: string) => void;
  onDeleteSubtask?: (parentId: string, subtaskId: string) => void;
  sortableDisabled?: boolean;
}

const COLOR_OPTIONS: { label: string; value: string }[] = [
  { label: 'グレー', value: '#9AA0A6' },
  { label: 'ブルー', value: '#4285F4' },
  { label: 'グリーン', value: '#34A853' },
  { label: 'レッド', value: '#EA4335' },
  { label: 'イエロー', value: '#FBBC04' },
  { label: 'パープル', value: '#A142F4' },
  { label: 'ティール', value: '#12B5CB' },
  { label: 'ピンク', value: '#F538A0' },
];

const STATUS_OPTIONS: { label: string; value: TaskStatusValue | null }[] = [
  { label: '同期しない', value: null },
  { label: '未着手 (TODO)', value: 'TODO' },
  { label: '進行中 (IN_PROGRESS)', value: 'IN_PROGRESS' },
  { label: '完了 (DONE)', value: 'DONE' },
];

export function BoardColumn({
  section,
  onAddTask,
  onRenameSection,
  onDeleteSection,
  onUpdateSection,
  listenNewTask,
  subtaskState,
  onToggleSubtask,
  onToggleSubtaskStatus,
  onDeleteSubtask,
  sortableDisabled,
}: BoardColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${section.id}`,
    data: { type: 'column', sectionId: section.id },
    disabled: sortableDisabled,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: { type: 'section', sectionId: section.id },
  });

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(section.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const taskIds = useMemo(() => section.tasks.map((t) => t.id), [section.tasks]);

  const handleRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== section.name) {
      onRenameSection?.(section.id, trimmed);
    }
    setEditing(false);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const accentColor = section.color ?? '#E0E0E0';

  return (
    <div
      ref={setSortableRef}
      style={style}
      className="flex h-full w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-lg bg-g-surface"
    >
      {/* Color accent bar */}
      <div className="h-1" style={{ backgroundColor: accentColor }} />

      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {!sortableDisabled && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab rounded p-0.5 text-g-text-muted hover:bg-g-border active:cursor-grabbing"
              aria-label="カラムを並べ替え"
              type="button"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
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
            <h3 className="truncate text-sm font-semibold text-g-text">{section.name}</h3>
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
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                setEditName(section.name);
                setEditing(true);
              }}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              名前を変更
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-normal text-g-text-muted">
              色
            </DropdownMenuLabel>
            <div className="flex flex-wrap gap-1.5 px-2 py-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onUpdateSection?.(section.id, { color: c.value })}
                  className={cn(
                    'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                    section.color === c.value ? 'border-g-text' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c.value }}
                  aria-label={c.label}
                  title={c.label}
                />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-normal text-g-text-muted">
              ステータス同期
            </DropdownMenuLabel>
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={s.value ?? 'none'}
                onClick={() => onUpdateSection?.(section.id, { statusMapping: s.value })}
              >
                <span className="mr-2 flex h-3.5 w-3.5 items-center justify-center">
                  {section.statusMapping === s.value && <Check className="h-3.5 w-3.5" />}
                </span>
                {s.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
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
          ref={setDroppableRef}
          className={cn(
            'min-h-[120px] space-y-2 pb-2 transition-all duration-150 rounded-lg',
            isOver && 'bg-[#4285F4]/8 ring-2 ring-inset ring-[#4285F4]/20',
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
