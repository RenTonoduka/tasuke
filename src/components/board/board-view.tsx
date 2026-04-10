'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { BoardColumn } from './board-column';
import { AddColumnButton } from './add-column-button';
import { TaskCard } from './task-card';
import { useFilterStore } from '@/stores/filter-store';
import { useSubtaskExpand } from '@/hooks/use-subtask-expand';
import { filterTasks } from '@/lib/task-filters';
import type { FilterState } from '@/stores/filter-store';
import { useRouter } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { useDragToProjectStore } from '@/stores/drag-to-project-store';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import type { Section, Task, TaskStatusValue } from '@/types';

// statusMapping が null の旧データ用の名前ベースフォールバック
const SECTION_NAME_FALLBACK: Record<string, TaskStatusValue> = {
  'todo': 'TODO', 'Todo': 'TODO', 'TODO': 'TODO', 'やること': 'TODO', '未着手': 'TODO',
  '進行中': 'IN_PROGRESS', 'In Progress': 'IN_PROGRESS', '対応中': 'IN_PROGRESS',
  '完了': 'DONE', 'Done': 'DONE', 'done': 'DONE',
};

function resolveSectionStatus(section: Pick<Section, 'name' | 'statusMapping'>): TaskStatusValue | undefined {
  return section.statusMapping ?? SECTION_NAME_FALLBACK[section.name];
}

const DROP_ANIMATION: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
};

interface BoardViewProps {
  initialSections: Section[];
  projectId: string;
  onSectionsChange?: (sections: Section[]) => void;
  logoUrl?: string;
}

export function BoardView({ initialSections, projectId, onSectionsChange, logoUrl }: BoardViewProps) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(initialSections);
  useEffect(() => { setSections(initialSections); }, [initialSections]);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { expanded: stExpanded, subtasks: stSubtasks, loading: stLoading, toggle: stToggle, toggleStatus: stToggleStatus, deleteSubtask: stDelete } = useSubtaskExpand();

  // Track source section for undo
  const dragSourceRef = useRef<{ sectionId: string; taskIndex: number } | null>(null);

  const { priority, status, assignee, label, dueDateFilter, sortBy, sortOrder, hasActiveFilters, hasFilterConditions } = useFilterStore();
  const isFiltered = hasActiveFilters();
  const isDndDisabled = hasFilterConditions();
  const isSortedOnly = sortBy !== 'position' && !isDndDisabled;
  const filteredSections = useMemo(() => {
    const f: FilterState = { priority, status, assignee, label, dueDateFilter, sortBy, sortOrder };
    return sections.map((s) => ({ ...s, tasks: filterTasks(s.tasks, f) }));
  }, [sections, priority, status, assignee, label, dueDateFilter, sortBy, sortOrder]);

  // [FIX] Hooks must be called unconditionally — never inline useSensors() in JSX
  const activeSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );
  const emptySensors = useSensors();
  const sensors = isDndDisabled ? emptySensors : activeSensors;
  const totalFilteredTasks = useMemo(() => filteredSections.reduce((sum, s) => sum + s.tasks.length, 0), [filteredSections]);

  // Custom collision detection: when dragging a column, only consider other columns as targets
  // (otherwise `section-${id}` droppable or task cards would win and column reorder wouldn't fire)
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeType = args.active.data.current?.type;
    if (activeType === 'column') {
      const columnContainers = args.droppableContainers.filter(
        (c) => c.data.current?.type === 'column' && c.id !== args.active.id,
      );
      return closestCenter({ ...args, droppableContainers: columnContainers });
    }
    // Task drag: keep the existing closestCenter behavior
    return closestCenter(args);
  }, []);

  // [FIX] Clean up pointer listeners on unmount to prevent memory leaks
  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const findSectionByTaskId = useCallback(
    (taskId: string) => {
      return sections.find((s) => s.tasks.some((t) => t.id === taskId));
    },
    [sections]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // Column drag
    if (active.data.current?.type === 'column') {
      setActiveColumnId(active.data.current.sectionId as string);
      return;
    }
    const task = active.data.current?.task as Task | undefined;
    if (task) {
      setActiveTask(task);
      const sourceSection = findSectionByTaskId(task.id);
      if (sourceSection) {
        const taskIndex = sourceSection.tasks.findIndex((t) => t.id === task.id);
        dragSourceRef.current = { sectionId: sourceSection.id, taskIndex };
      }
    }
    useDragToProjectStore.getState().startDrag(projectId);
    // [FIX] Clean previous listeners before adding new ones
    cleanupRef.current?.();
    pointerRef.current = null;
    const handler = (e: PointerEvent) => { pointerRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointermove', handler, true);
    window.addEventListener('pointerup', handler, true);
    cleanupRef.current = () => {
      window.removeEventListener('pointermove', handler, true);
      window.removeEventListener('pointerup', handler, true);
    };
  };

  // [FIX] Use prev-based state update to avoid stale closure references
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    // Column drag: skip (handled in handleDragEnd)
    if (active.data.current?.type === 'column') return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setSections((prev) => {
      const activeSection = prev.find((s) => s.tasks.some((t) => t.id === activeId));
      let overSectionId: string | null = null;

      if (overId.startsWith('section-')) {
        overSectionId = overId.replace('section-', '');
      } else {
        const overSection = prev.find((s) => s.tasks.some((t) => t.id === overId));
        overSectionId = overSection?.id ?? null;
      }

      if (!activeSection || !overSectionId || activeSection.id === overSectionId) return prev;

      const task = activeSection.tasks.find((t) => t.id === activeId);
      if (!task) return prev;

      return prev.map((s) => {
        if (s.id === activeSection.id) {
          return { ...s, tasks: s.tasks.filter((t) => t.id !== activeId) };
        }
        if (s.id === overSectionId) {
          const overIndex = s.tasks.findIndex((t) => t.id === overId);
          const insertIndex = overIndex >= 0 ? overIndex : s.tasks.length;
          const newTasks = [...s.tasks];
          const mappedStatus = resolveSectionStatus(s);
          newTasks.splice(insertIndex, 0, {
            ...task,
            sectionId: s.id,
            ...(mappedStatus && { status: mappedStatus }),
          });
          return { ...s, tasks: newTasks };
        }
        return s;
      });
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // Column drag end
    if (active.data.current?.type === 'column') {
      setActiveColumnId(null);
      if (!over || active.id === over.id) return;
      const activeSectionId = active.data.current.sectionId as string;
      const overData = over.data.current;
      const overSectionId =
        overData?.type === 'column' ? (overData.sectionId as string) : null;
      if (!overSectionId || activeSectionId === overSectionId) return;

      const prevSnapshot = sectionsRef.current.map((s) => ({ ...s, tasks: [...s.tasks] }));
      const oldIndex = prevSnapshot.findIndex((s) => s.id === activeSectionId);
      const newIndex = prevSnapshot.findIndex((s) => s.id === overSectionId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(prevSnapshot, oldIndex, newIndex);
      setSections(reordered);

      // Persist new order
      const payload = {
        sections: reordered.map((s, idx) => ({ id: s.id, position: idx })),
      };
      try {
        const res = await fetch(`/api/projects/${projectId}/sections`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('failed');
      } catch {
        setSections(prevSnapshot);
        toast({ title: 'カラムの並べ替えに失敗', variant: 'destructive' });
      }
      return;
    }

    const draggedTask = activeTask;
    const dragSource = dragSourceRef.current;
    setActiveTask(null);
    dragSourceRef.current = null;
    cleanupRef.current?.();
    cleanupRef.current = null;
    useDragToProjectStore.getState().reset();

    // Cross-project move detection
    if (pointerRef.current && draggedTask) {
      const { x, y } = pointerRef.current;
      const els = document.elementsFromPoint(x, y);
      const projectEl = els.find((el) => el.getAttribute('data-project-drop-id'));
      const targetProjectId = projectEl?.getAttribute('data-project-drop-id');
      if (targetProjectId && targetProjectId !== projectId) {
        const taskId = active.id as string;
        const snapshot = [...sectionsRef.current.map((s) => ({ ...s, tasks: [...s.tasks] }))];
        setSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== taskId) })));
        try {
          const res = await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: targetProjectId }),
          });
          if (res.ok) {
            toast({
              title: `「${draggedTask.title}」を別プロジェクトに移動しました`,
              action: (
                <ToastAction altText="元に戻す" onClick={async () => {
                  await fetch(`/api/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId }),
                  });
                  setSections(snapshot);
                  router.refresh();
                }}>
                  元に戻す
                </ToastAction>
              ),
            });
            router.refresh();
          } else {
            setSections(snapshot);
            toast({ title: 'タスクの移動に失敗', variant: 'destructive' });
          }
        } catch {
          setSections(snapshot);
          toast({ title: 'タスクの移動に失敗', variant: 'destructive' });
        }
        pointerRef.current = null;
        return;
      }
    }
    pointerRef.current = null;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const section = findSectionByTaskId(activeId);
    if (!section) return;

    if (activeId !== overId && !overId.startsWith('section-') && !isSortedOnly) {
      const sameSection = section.tasks.some((t) => t.id === overId);
      if (sameSection) {
        setSections((prev) =>
          prev.map((s) => {
            if (s.id !== section.id) return s;
            const oldIndex = s.tasks.findIndex((t) => t.id === activeId);
            const newIndex = s.tasks.findIndex((t) => t.id === overId);
            return { ...s, tasks: arrayMove(s.tasks, oldIndex, newIndex) };
          })
        );
      }
    }

    // API更新
    const updatedSection = sectionsRef.current.find((s) => s.tasks.some((t) => t.id === activeId));
    if (!updatedSection) return;

    const taskIndex = updatedSection.tasks.findIndex((t) => t.id === activeId);
    const taskCount = updatedSection.tasks.length;
    // Use integer positions to avoid float convergence
    const newPosition = taskCount <= 1 ? 1000 : Math.round((taskIndex / (taskCount - 1)) * taskCount * 1000);

    // Capture for undo
    const snapshot = sectionsRef.current.map((s) => ({ ...s, tasks: [...s.tasks] }));
    const movedAcrossSections = dragSource && dragSource.sectionId !== updatedSection.id;

    try {
      const res = await fetch(`/api/tasks/${activeId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: updatedSection.id,
          position: newPosition,
        }),
      });

      if (res.ok && movedAcrossSections && draggedTask) {
        const destSectionName = updatedSection.name;
        toast({
          title: `「${draggedTask.title}」を「${destSectionName}」に移動`,
          action: (
            <ToastAction altText="元に戻す" onClick={async () => {
              await fetch(`/api/tasks/${activeId}/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sectionId: dragSource.sectionId,
                  position: dragSource.taskIndex * 1000,
                }),
              });
              setSections(snapshot);
              router.refresh();
            }}>
              元に戻す
            </ToastAction>
          ),
        });
      }
    } catch {
      setSections(snapshot);
      toast({ title: 'タスクの移動に失敗', variant: 'destructive' });
    }
  };

  const handleRenameSection = async (sectionId: string, name: string) => {
    try {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setSections((prev) => {
          const next = prev.map((s) => s.id === sectionId ? { ...s, name } : s);
          onSectionsChange?.(next);
          return next;
        });
      } else {
        toast({ title: 'セクション名の変更に失敗', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'セクション名の変更に失敗', variant: 'destructive' });
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      const res = await fetch(`/api/sections/${sectionId}`, { method: 'DELETE' });
      if (res.ok) {
        setSections((prev) => {
          const next = prev.filter((s) => s.id !== sectionId);
          onSectionsChange?.(next);
          return next;
        });
      } else {
        toast({ title: 'セクションの削除に失敗', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'セクションの削除に失敗', variant: 'destructive' });
    }
  };

  const handleCreateSection = async (name: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        toast({ title: 'カラムの作成に失敗', variant: 'destructive' });
        return;
      }
      const payload = await res.json();
      const created = payload?.data ?? payload;
      setSections((prev) => {
        const next = [...prev, { ...created, tasks: [] } as Section];
        onSectionsChange?.(next);
        return next;
      });
    } catch {
      toast({ title: 'カラムの作成に失敗', variant: 'destructive' });
    }
  };

  const handleUpdateSection = async (
    sectionId: string,
    data: { color?: string | null; statusMapping?: TaskStatusValue | null },
  ) => {
    // Optimistic update
    const snapshot = sectionsRef.current.map((s) => ({ ...s, tasks: [...s.tasks] }));
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, ...data } : s)),
    );
    try {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      setSections(snapshot);
      toast({ title: 'カラムの更新に失敗', variant: 'destructive' });
    }
  };

  const handleAddTask = async (sectionId: string, title: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sectionId }),
      });
      if (!res.ok) {
        toast({ title: 'タスクの作成に失敗', variant: 'destructive' });
        return;
      }
      const task = await res.json();

      setSections((prev) => {
        const next = prev.map((s) =>
          s.id === sectionId ? { ...s, tasks: [...s.tasks, task] } : s
        );
        onSectionsChange?.(next);
        return next;
      });
    } catch {
      toast({ title: 'タスクの作成に失敗', variant: 'destructive' });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTask(null);
        setActiveColumnId(null);
        dragSourceRef.current = null;
        cleanupRef.current?.();
        cleanupRef.current = null;
        pointerRef.current = null;
        useDragToProjectStore.getState().reset();
      }}
    >
      <div className="relative flex items-start gap-4 overflow-x-auto p-4">
        {logoUrl && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.03]">
            <img src={logoUrl} alt="" className="max-h-[60%] max-w-[60%] object-contain" />
          </div>
        )}
        <SortableContext
          items={filteredSections.map((s) => `column-${s.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          {filteredSections.map((section, index) => (
            <BoardColumn
              key={section.id}
              section={section}
              onAddTask={handleAddTask}
              onRenameSection={handleRenameSection}
              onDeleteSection={handleDeleteSection}
              onUpdateSection={handleUpdateSection}
              listenNewTask={index === 0}
              subtaskState={{ expanded: stExpanded, subtasks: stSubtasks, loading: stLoading }}
              onToggleSubtask={stToggle}
              onToggleSubtaskStatus={stToggleStatus}
              onDeleteSubtask={stDelete}
              sortableDisabled={isDndDisabled}
            />
          ))}
        </SortableContext>
        {!isDndDisabled && <AddColumnButton onAdd={handleCreateSection} />}
      </div>
      {isFiltered && totalFilteredTasks === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-g-text-muted">
          <SearchX className="mb-2 h-8 w-8" />
          <p className="text-sm">フィルター条件に一致するタスクがありません</p>
        </div>
      )}

      <DragOverlay dropAnimation={DROP_ANIMATION}>
        {activeTask ? (
          <TaskCard task={activeTask} overlay />
        ) : activeColumnId ? (
          (() => {
            const s = sections.find((sec) => sec.id === activeColumnId);
            if (!s) return null;
            return (
              <div className="w-[280px] rounded-lg bg-g-surface opacity-90 shadow-lg">
                <div className="h-1" style={{ backgroundColor: s.color ?? '#E0E0E0' }} />
                <div className="px-3 py-2 text-sm font-semibold text-g-text">
                  {s.name}{' '}
                  <span className="ml-1 rounded-full bg-g-border px-2 py-0.5 text-xs text-g-text-secondary">
                    {s.tasks.length}
                  </span>
                </div>
              </div>
            );
          })()
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
