'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { BoardColumn } from './board-column';
import { TaskCard } from './task-card';
import { useFilterStore } from '@/stores/filter-store';
import { useSubtaskExpand } from '@/hooks/use-subtask-expand';
import { filterTasks } from '@/lib/task-filters';
import type { FilterState } from '@/stores/filter-store';
import { useRouter } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { useDragToProjectStore } from '@/stores/drag-to-project-store';
import type { Section, Task } from '@/types';

const SECTION_STATUS_MAP: Record<string, 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
  'todo': 'TODO', 'Todo': 'TODO', 'TODO': 'TODO', 'やること': 'TODO', '未着手': 'TODO',
  '進行中': 'IN_PROGRESS', 'In Progress': 'IN_PROGRESS', '対応中': 'IN_PROGRESS',
  '完了': 'DONE', 'Done': 'DONE', 'done': 'DONE',
};

interface BoardViewProps {
  initialSections: Section[];
  projectId: string;
  onSectionsChange?: (sections: Section[]) => void;
}

export function BoardView({ initialSections, projectId, onSectionsChange }: BoardViewProps) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(initialSections);
  useEffect(() => { setSections(initialSections); }, [initialSections]);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { expanded: stExpanded, subtasks: stSubtasks, loading: stLoading, toggle: stToggle, toggleStatus: stToggleStatus, deleteSubtask: stDelete } = useSubtaskExpand();

  const { priority, status, assignee, label, dueDateFilter, sortBy, sortOrder, hasActiveFilters } = useFilterStore();
  const isFiltered = hasActiveFilters();
  const filteredSections = useMemo(() => {
    const f: FilterState = { priority, status, assignee, label, dueDateFilter, sortBy, sortOrder };
    return sections.map((s) => ({ ...s, tasks: filterTasks(s.tasks, f) }));
  }, [sections, priority, status, assignee, label, dueDateFilter, sortBy, sortOrder]);

  const activeSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );
  const emptySensors = useSensors();
  const sensors = isFiltered ? emptySensors : activeSensors;
  const totalFilteredTasks = filteredSections.reduce((sum, s) => sum + s.tasks.length, 0);

  const findSectionByTaskId = useCallback(
    (taskId: string) => {
      return sections.find((s) => s.tasks.some((t) => t.id === taskId));
    },
    [sections]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = active.data.current?.task as Task | undefined;
    if (task) setActiveTask(task);
    // プロジェクト移動D&D: ストアとポインター追跡
    const store = useDragToProjectStore.getState();
    store.isDraggingTask = true;
    store.sourceProjectId = projectId;
    pointerRef.current = null;
    const handler = (e: PointerEvent) => { pointerRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointermove', handler);
    cleanupRef.current = () => window.removeEventListener('pointermove', handler);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeSection = findSectionByTaskId(activeId);
    let overSectionId: string | null = null;

    if (overId.startsWith('section-')) {
      overSectionId = overId.replace('section-', '');
    } else {
      const overSection = findSectionByTaskId(overId);
      overSectionId = overSection?.id ?? null;
    }

    if (!activeSection || !overSectionId || activeSection.id === overSectionId) return;

    setSections((prev) => {
      const sourceSec = prev.find((s) => s.id === activeSection.id);
      const destSec = prev.find((s) => s.id === overSectionId);
      if (!sourceSec || !destSec) return prev;

      const task = sourceSec.tasks.find((t) => t.id === activeId);
      if (!task) return prev;

      return prev.map((s) => {
        if (s.id === sourceSec.id) {
          return { ...s, tasks: s.tasks.filter((t) => t.id !== activeId) };
        }
        if (s.id === destSec.id) {
          const overIndex = s.tasks.findIndex((t) => t.id === overId);
          const insertIndex = overIndex >= 0 ? overIndex : s.tasks.length;
          const newTasks = [...s.tasks];
          const mappedStatus = SECTION_STATUS_MAP[s.name];
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
    setActiveTask(null);
    cleanupRef.current?.();
    cleanupRef.current = null;
    useDragToProjectStore.getState().reset();

    // ★ ボード外ドロップ → プロジェクト移動判定（over===nullの時のみ）
    if (!over && pointerRef.current) {
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
            router.refresh();
          } else {
            setSections(snapshot);
          }
        } catch {
          setSections(snapshot);
        }
        return;
      }
    }
    pointerRef.current = null;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // 同一セクション内の並べ替え
    const section = findSectionByTaskId(activeId);
    if (!section) return;

    if (activeId !== overId && !overId.startsWith('section-')) {
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

    // API更新（最新のstateを参照）
    const updatedSection = sectionsRef.current.find((s) => s.tasks.some((t) => t.id === activeId));
    if (!updatedSection) return;

    const taskIndex = updatedSection.tasks.findIndex((t) => t.id === activeId);
    const prevPos = updatedSection.tasks[taskIndex - 1]?.position ?? 0;
    const nextPos = updatedSection.tasks[taskIndex + 1]?.position ?? prevPos + 2;
    const newPosition = (prevPos + nextPos) / 2;

    try {
      await fetch(`/api/tasks/${activeId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: updatedSection.id,
          position: newPosition,
        }),
      });
    } catch {
      setSections(initialSections);
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
      }
    } catch {}
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
      }
    } catch {}
  };

  const handleAddTask = async (sectionId: string, title: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sectionId }),
      });
      const task = await res.json();

      setSections((prev) => {
        const next = prev.map((s) =>
          s.id === sectionId ? { ...s, tasks: [...s.tasks, task] } : s
        );
        onSectionsChange?.(next);
        return next;
      });
    } catch (err) {
      console.error('タスク作成エラー:', err);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto p-4">
        {filteredSections.map((section, index) => (
          <BoardColumn
            key={section.id}
            section={section}
            onAddTask={handleAddTask}
            onRenameSection={handleRenameSection}
            onDeleteSection={handleDeleteSection}
            listenNewTask={index === 0}
            subtaskState={{ expanded: stExpanded, subtasks: stSubtasks, loading: stLoading }}
            onToggleSubtask={stToggle}
            onToggleSubtaskStatus={stToggleStatus}
            onDeleteSubtask={stDelete}
          />
        ))}
      </div>
      {isFiltered && totalFilteredTasks === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-g-text-muted">
          <SearchX className="mb-2 h-8 w-8" />
          <p className="text-sm">フィルター条件に一致するタスクがありません</p>
        </div>
      )}

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
