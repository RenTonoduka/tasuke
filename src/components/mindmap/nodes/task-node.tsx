import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronRight, ChevronDown, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { useMindMapStore } from '@/stores/mindmap-store';
import { PRIORITY_COLORS } from '@/lib/mindmap-utils';
import type { Task } from '@/types';

type TaskNodeData = {
  label: string;
  task?: Task;
  projectId?: string;
  isEditing?: boolean;
  isAdding?: boolean;
  isSelected?: boolean;
  hasChildren?: boolean;
  childrenLoaded?: boolean;
  isCollapsed?: boolean;
  childCount?: number;
  isLoading?: boolean;
  subtaskCount?: number;
  onRefetch?: () => void;
  onSubtaskCreated?: (parentTaskId: string) => void;
  [key: string]: unknown;
};

type TaskNodeType = Node<TaskNodeData, 'taskNode'>;

function TaskNodeComponent({ data }: NodeProps<TaskNodeType>) {
  const direction = useMindMapStore((s) => s.direction);
  const setEditingNodeId = useMindMapStore((s) => s.setEditingNodeId);
  const setAddingNodeId = useMindMapStore((s) => s.setAddingNodeId);
  const clearInteraction = useMindMapStore((s) => s.clearInteraction);
  const sourcePos = direction === 'RIGHT' ? Position.Right : Position.Bottom;
  const targetPos = direction === 'RIGHT' ? Position.Left : Position.Top;
  const task = data.task;
  const isDone = task?.status === 'DONE';

  const [editValue, setEditValue] = useState(data.label);
  const [addValue, setAddValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (data.isEditing) {
      setEditValue(data.label);
      isSavingRef.current = false;
      setTimeout(() => editRef.current?.select(), 0);
    }
  }, [data.isEditing, data.label]);

  useEffect(() => {
    if (data.isAdding) {
      setAddValue('');
      isSavingRef.current = false;
      setTimeout(() => addRef.current?.focus(), 0);
    }
  }, [data.isAdding]);

  const saveTitle = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    const trimmed = editValue.trim();
    clearInteraction();
    if (!trimmed || trimmed === data.label || !task) return;
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      data.onRefetch?.();
    } catch (err) {
      console.error('タイトル更新エラー:', err);
    }
  }, [editValue, data, task, clearInteraction]);

  const addSubtask = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    const trimmed = addValue.trim();
    clearInteraction();
    if (!trimmed || !task) return;
    try {
      await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      data.onSubtaskCreated?.(task.id);
    } catch (err) {
      console.error('サブタスク追加エラー:', err);
    }
  }, [addValue, task, data, clearInteraction]);

  const handleAddClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAddingNodeId(data.task ? `task-${data.task.id}` : null);
  }, [data.task, setAddingNodeId]);

  // 編集モード
  if (data.isEditing) {
    return (
      <div
        className="relative flex items-center gap-2 rounded-lg border border-[#4285F4] bg-g-bg px-3 py-2 shadow-md"
        style={{ minWidth: 220, maxWidth: 280 }}
      >
        <Handle type="target" position={targetPos} className="!bg-g-border !w-2 !h-2" />
        <input
          ref={editRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.currentTarget.blur(); }
            if (e.key === 'Escape') { setEditValue(data.label); clearInteraction(); }
            e.stopPropagation();
          }}
          className="flex-1 bg-transparent text-xs text-g-text outline-none"
          maxLength={200}
        />
        {data.hasChildren && (
          <Handle type="source" position={sourcePos} className="!bg-g-border !w-2 !h-2" />
        )}
      </div>
    );
  }

  // サブタスク追加入力
  if (data.isAdding) {
    return (
      <div
        className="relative flex items-center gap-2 rounded-lg border border-[#34A853] bg-g-bg px-3 py-2 shadow-md"
        style={{ minWidth: 220, maxWidth: 280 }}
      >
        <Handle type="target" position={targetPos} className="!bg-g-border !w-2 !h-2" />
        <Plus className="h-3.5 w-3.5 shrink-0 text-[#34A853]" />
        <input
          ref={addRef}
          value={addValue}
          onChange={(e) => setAddValue(e.target.value)}
          onBlur={addSubtask}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.currentTarget.blur(); }
            if (e.key === 'Escape') { clearInteraction(); }
            e.stopPropagation();
          }}
          placeholder="サブタスク名..."
          className="flex-1 bg-transparent text-xs text-g-text outline-none placeholder:text-g-text-muted"
          maxLength={200}
        />
        {data.hasChildren && (
          <Handle type="source" position={sourcePos} className="!bg-g-border !w-2 !h-2" />
        )}
      </div>
    );
  }

  // 通常表示
  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border ${data.isSelected ? 'border-[#4285F4] shadow-md' : 'border-g-border shadow-sm'} bg-g-bg px-3 py-2 hover:shadow-md transition-shadow cursor-pointer`}
      style={{ minWidth: 220, maxWidth: 220 }}
      title={data.label}
    >
      <Handle type="target" position={targetPos} className="!bg-g-border !w-2 !h-2" />

      {task && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#80868B' }}
        />
      )}

      {isDone ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#34A853]" />
      ) : task?.status === 'IN_PROGRESS' ? (
        <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#4285F4] bg-[#4285F4]/30 animate-[pulse_2s_ease-in-out_infinite]" />
      ) : (
        <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-g-text-muted" />
      )}

      <span className={`flex-1 truncate text-xs text-g-text ${isDone ? 'line-through text-g-text-muted' : ''}`}>
        {data.label}
      </span>

      {data.hasChildren && (
        <span className="flex items-center gap-0.5 text-g-text-secondary">
          {data.isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : data.isCollapsed || !data.childrenLoaded ? (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[10px]">{data.childCount}</span>
            </>
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </span>
      )}

      {/* + ボタン（ホバー時表示） */}
      <button
        onClick={handleAddClick}
        className="absolute -right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-[#4285F4] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-[#3367d6]"
        title="サブタスクを追加"
      >
        <Plus className="h-2.5 w-2.5" />
      </button>

      {data.hasChildren && (
        <Handle type="source" position={sourcePos} className="!bg-g-border !w-2 !h-2" />
      )}
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
