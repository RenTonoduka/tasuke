'use client';

import { useState, useMemo, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { BoardView } from '@/components/board/board-view';
import { ListView } from '@/components/list/list-view';
import { TimelineView } from '@/components/timeline/timeline-view';
import { ScheduleView } from '@/components/schedule/schedule-view';
import { ProjectDashboardView } from '@/components/dashboard/project-dashboard-view';
import { MindMapView } from '@/components/mindmap/mindmap-view';
import { TaskDetailPanel } from '@/components/task/task-detail-panel';
import { FilterBar } from '@/components/shared/filter-bar';
import { BulkActionBar } from '@/components/shared/bulk-action-bar';
import { useFilterUrlSync } from '@/hooks/use-filter-url-sync';
import { useSelectionStore } from '@/stores/selection-store';
import { useFilterStore } from '@/stores/filter-store';
import type { FilterBarMember, FilterBarLabel } from '@/components/shared/filter-bar';
import type { Project, Section } from '@/types';

interface ProjectPageClientProps {
  project: Project;
  workspaceSlug: string;
}

export function ProjectPageClient({ project, workspaceSlug }: ProjectPageClientProps) {
  const [view, setView] = useState<'board' | 'list' | 'timeline' | 'schedule' | 'dashboard' | 'mindmap'>('board');
  const [sections, setSections] = useState<Section[]>(project.sections);
  useFilterUrlSync();

  const handleViewChange = useCallback((v: typeof view) => {
    useSelectionStore.getState().clear();
    if (v === 'schedule' || v === 'dashboard' || v === 'mindmap') {
      useFilterStore.getState().reset();
    }
    setView(v);
  }, []);

  // Extract unique members and labels from tasks for filter bar
  const { members, labels } = useMemo(() => {
    const memberMap = new Map<string, FilterBarMember>();
    const labelMap = new Map<string, FilterBarLabel>();
    for (const section of sections) {
      for (const task of section.tasks) {
        for (const a of task.assignees) {
          if (!memberMap.has(a.user.id)) {
            memberMap.set(a.user.id, { id: a.user.id, name: a.user.name, image: a.user.image });
          }
        }
        for (const tl of task.labels) {
          if (!labelMap.has(tl.label.id)) {
            labelMap.set(tl.label.id, { id: tl.label.id, name: tl.label.name, color: tl.label.color });
          }
        }
      }
    }
    return {
      members: Array.from(memberMap.values()),
      labels: Array.from(labelMap.values()),
    };
  }, [sections]);

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

  const refetchSections = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setSections(data.sections);
      }
    } catch {}
  }, [project.id]);

  const handleBulkAction = () => {
    refetchSections();
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
        onViewChange={handleViewChange}
        workspaceSlug={workspaceSlug}
        workspaceId={project.workspaceId}
        projectId={project.id}
        projectName={project.name}
      />

      {['board', 'list', 'timeline'].includes(view) && (
        <FilterBar members={members} labels={labels} />
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'board' && (
          <BoardView initialSections={sections} projectId={project.id} onSectionsChange={setSections} />
        )}
        {view === 'list' && (
          <ListView
            sections={sections}
            projectId={project.id}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
          />
        )}
        {view === 'timeline' && (
          <TimelineView sections={sections} projectId={project.id} />
        )}
        {view === 'schedule' && (
          <ScheduleView projectId={project.id} />
        )}
        {view === 'dashboard' && (
          <ProjectDashboardView sections={sections} projectId={project.id} />
        )}
        {view === 'mindmap' && (
          <MindMapView sections={sections} projectId={project.id} projectName={project.name} projectColor={project.color} onRefetch={refetchSections} />
        )}
      </div>

      <TaskDetailPanel />
      <BulkActionBar onAction={handleBulkAction} />
    </>
  );
}
