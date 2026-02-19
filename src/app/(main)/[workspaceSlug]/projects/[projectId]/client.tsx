'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { BoardView } from '@/components/board/board-view';
import { ListView } from '@/components/list/list-view';
import { TaskDetailPanel } from '@/components/task/task-detail-panel';
import { FilterBar } from '@/components/shared/filter-bar';
import type { Project, Section } from '@/types';

interface ProjectPageClientProps {
  project: Project;
}

export function ProjectPageClient({ project }: ProjectPageClientProps) {
  const [view, setView] = useState<'board' | 'list'>('board');
  const [sections, setSections] = useState<Section[]>(project.sections);

  const handleAddTask = async (sectionId: string, title: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sectionId }),
      });
      if (res.ok) {
        const task = await res.json();
        setSections((prev) =>
          prev.map((s) =>
            s.id === sectionId ? { ...s, tasks: [...s.tasks, task] } : s
          )
        );
      }
    } catch (err) {
      console.error('タスク作成エラー:', err);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: newStatus as 'TODO' | 'DONE' } : t
          ),
        }))
      );
    } catch (err) {
      console.error('ステータス更新エラー:', err);
    }
  };

  return (
    <>
      <Header
        title={project.name}
        view={view}
        onViewChange={setView}
      />

      <FilterBar />

      <div className="flex-1 overflow-hidden">
        {view === 'board' ? (
          <BoardView initialSections={sections} projectId={project.id} onSectionsChange={setSections} />
        ) : (
          <ListView
            sections={sections}
            projectId={project.id}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
          />
        )}
      </div>

      <TaskDetailPanel />
    </>
  );
}
