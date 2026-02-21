'use client';

import { useState, useCallback, useMemo } from 'react';
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
import { filterTasks } from '@/lib/task-filters';
import type { FilterState } from '@/stores/filter-store';
import type { Section, Task } from '@/types';

interface BoardViewProps {
  initialSections: Section[];
  projectId: string;
  onSectionsChange?: (sections: Section[]) => void;
}

export function BoardView({ initialSections, projectId, onSectionsChange }: BoardViewProps) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const { priority, status, assignee, label, dueDateFilter, sortBy, sortOrder } = useFilterStore();
  const filteredSections = useMemo(() => {
    const f: FilterState = { priority, status, assignee, label, dueDateFilter, sortBy, sortOrder };
    return sections.map((s) => ({ ...s, tasks: filterTasks(s.tasks, f) }));
  }, [sections, priority, status, assignee, label, dueDateFilter, sortBy, sortOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

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
          newTasks.splice(insertIndex, 0, { ...task, sectionId: s.id });
          return { ...s, tasks: newTasks };
        }
        return s;
      });
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

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

    // API更新
    const updatedSection = sections.find((s) => s.tasks.some((t) => t.id === activeId));
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
      // 楽観的更新のロールバック - ページリロードで復帰
      setSections(initialSections);
    }
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
        {filteredSections.map((section) => (
          <BoardColumn
            key={section.id}
            section={section}
            onAddTask={handleAddTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
