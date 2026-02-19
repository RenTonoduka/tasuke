'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Flag, FolderKanban } from 'lucide-react';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { TaskDetailPanel } from '@/components/task/task-detail-panel';
import { cn } from '@/lib/utils';

const priorityConfig: Record<string, { label: string; color: string }> = {
  P0: { label: 'P0', color: '#EA4335' },
  P1: { label: 'P1', color: '#FBBC04' },
  P2: { label: 'P2', color: '#4285F4' },
  P3: { label: 'P3', color: '#80868B' },
};

interface MyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  section: {
    project: { id: string; name: string; color: string };
  };
  assignees: { id: string; user: { id: string; name: string | null; image: string | null } }[];
  labels: { id: string; label: { id: string; name: string; color: string } }[];
  _count: { subtasks: number };
}

interface MyTasksClientProps {
  tasks: MyTask[];
  workspaceSlug: string;
}

export function MyTasksClient({ tasks: initialTasks, workspaceSlug }: MyTasksClientProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const openPanel = useTaskPanelStore((s) => s.open);

  const handleToggle = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error('ステータス更新エラー:', err);
    }
  };

  const pending = tasks.filter((t) => t.status !== 'DONE');
  const done = tasks.filter((t) => t.status === 'DONE');

  return (
    <div className="flex-1 overflow-auto">
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[#5F6368]">担当タスクがありません</p>
          <p className="mt-1 text-sm text-[#80868B]">
            プロジェクト内でタスクをアサインすると表示されます
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 bg-[#F8F9FA] px-4 py-2">
                <span className="text-sm font-semibold text-[#202124]">未完了</span>
                <span className="rounded-full bg-[#E8EAED] px-2 py-0.5 text-xs text-[#5F6368]">
                  {pending.length}
                </span>
              </div>
              {pending.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  workspaceSlug={workspaceSlug}
                  onOpen={() => openPanel(task.id)}
                  onToggle={() => handleToggle(task.id, task.status)}
                />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div>
              <div className="flex items-center gap-2 bg-[#F8F9FA] px-4 py-2 border-t border-[#E8EAED]">
                <span className="text-sm font-semibold text-[#202124]">完了</span>
                <span className="rounded-full bg-[#E8EAED] px-2 py-0.5 text-xs text-[#5F6368]">
                  {done.length}
                </span>
              </div>
              {done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  workspaceSlug={workspaceSlug}
                  onOpen={() => openPanel(task.id)}
                  onToggle={() => handleToggle(task.id, task.status)}
                />
              ))}
            </div>
          )}
        </>
      )}
      <TaskDetailPanel />
    </div>
  );
}

function TaskRow({
  task,
  workspaceSlug,
  onOpen,
  onToggle,
}: {
  task: MyTask;
  workspaceSlug: string;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const p = priorityConfig[task.priority] ?? priorityConfig.P3;

  return (
    <div
      className="flex items-center gap-3 border-b border-[#F1F3F4] px-4 py-2 hover:bg-[#F8F9FA] cursor-pointer"
      onClick={onOpen}
    >
      <Checkbox
        checked={task.status === 'DONE'}
        onCheckedChange={() => onToggle()}
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

      {/* Project name */}
      <a
        href={`/${workspaceSlug}/projects/${task.section.project.id}`}
        className="hidden items-center gap-1 text-xs text-[#5F6368] hover:text-[#202124] sm:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <FolderKanban className="h-3 w-3" style={{ color: task.section.project.color }} />
        {task.section.project.name}
      </a>

      <div className="hidden items-center gap-1 sm:flex">
        <Flag className="h-3 w-3" style={{ color: p.color }} />
        <span className="text-xs text-[#5F6368]">{p.label}</span>
      </div>

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

      {task.dueDate && (
        <span className="hidden items-center gap-1 text-xs text-[#5F6368] sm:flex">
          <Calendar className="h-3 w-3" />
          {new Date(task.dueDate).toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )}
    </div>
  );
}
