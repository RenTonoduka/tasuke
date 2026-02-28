import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { useMindMapStore } from '@/stores/mindmap-store';

type SectionNodeData = {
  label: string;
  sectionId?: string;
  projectId?: string;
  taskCount?: number;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  isEditing?: boolean;
  isAdding?: boolean;
  isSelected?: boolean;
  onRefetch?: () => void;
  [key: string]: unknown;
};

type SectionNodeType = Node<SectionNodeData, 'sectionNode'>;

function SectionNodeComponent({ id, data }: NodeProps<SectionNodeType>) {
  const direction = useMindMapStore((s) => s.direction);
  const setAddingNodeId = useMindMapStore((s) => s.setAddingNodeId);
  const clearInteraction = useMindMapStore((s) => s.clearInteraction);
  const sourcePos = direction === 'RIGHT' ? Position.Right : Position.Bottom;
  const targetPos = direction === 'RIGHT' ? Position.Left : Position.Top;

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

  const saveSectionName = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    const trimmed = editValue.trim();
    clearInteraction();
    if (!trimmed || trimmed === data.label || !data.sectionId) return;
    try {
      await fetch(`/api/sections/${data.sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      data.onRefetch?.();
    } catch (err) {
      console.error('セクション名更新エラー:', err);
    }
  }, [editValue, data, clearInteraction]);

  const addTask = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    const trimmed = addValue.trim();
    clearInteraction();
    if (!trimmed || !data.projectId || !data.sectionId) return;
    try {
      await fetch(`/api/projects/${data.projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, sectionId: data.sectionId }),
      });
      data.onRefetch?.();
    } catch (err) {
      console.error('タスク追加エラー:', err);
    }
  }, [addValue, data, clearInteraction]);

  const handleAddClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAddingNodeId(id);
  }, [id, setAddingNodeId]);

  // 編集モード
  if (data.isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#4285F4] bg-g-surface px-4 py-2.5 shadow-md"
        style={{ minWidth: 180 }}
      >
        <Handle type="target" position={targetPos} className="!bg-g-border !w-2 !h-2" />
        <input
          ref={editRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveSectionName}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') { e.currentTarget.blur(); }
            if (e.key === 'Escape') { setEditValue(data.label); clearInteraction(); }
            e.stopPropagation();
          }}
          className="flex-1 bg-transparent text-xs font-semibold text-g-text outline-none"
          maxLength={100}
        />
        <Handle type="source" position={sourcePos} className="!bg-g-border !w-2 !h-2" />
      </div>
    );
  }

  // タスク追加入力
  if (data.isAdding) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#34A853] bg-g-surface px-4 py-2.5 shadow-md"
        style={{ minWidth: 180 }}
      >
        <Handle type="target" position={targetPos} className="!bg-g-border !w-2 !h-2" />
        <Plus className="h-3.5 w-3.5 shrink-0 text-[#34A853]" />
        <input
          ref={addRef}
          value={addValue}
          onChange={(e) => setAddValue(e.target.value)}
          onBlur={addTask}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') { e.currentTarget.blur(); }
            if (e.key === 'Escape') { clearInteraction(); }
            e.stopPropagation();
          }}
          placeholder="タスク名..."
          className="flex-1 bg-transparent text-xs text-g-text outline-none placeholder:text-g-text-muted"
          maxLength={200}
        />
        <Handle type="source" position={sourcePos} className="!bg-g-border !w-2 !h-2" />
      </div>
    );
  }

  // 通常表示
  return (
    <div className={`group flex items-center gap-2 rounded-lg border ${data.isSelected ? 'border-[#4285F4] shadow-md' : 'border-g-border shadow-sm'} bg-g-surface px-4 py-2.5`}
      style={{ minWidth: 180 }}
      title={data.label}
    >
      <Handle type="target" position={targetPos} className="!bg-g-border !w-2 !h-2" />

      {data.hasChildren && (
        <span className="text-g-text-secondary">
          {data.isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      )}

      <span className="truncate text-xs font-semibold text-g-text">{data.label}</span>

      <span className="ml-auto rounded-full bg-g-border px-1.5 py-0.5 text-[10px] text-g-text-secondary">
        {data.taskCount ?? 0}
      </span>

      {/* + ボタン（ホバー時表示） */}
      <button
        onClick={handleAddClick}
        className="flex h-4 w-4 items-center justify-center rounded-full bg-[#34A853] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-[#2d8e47]"
        title="タスクを追加"
      >
        <Plus className="h-2.5 w-2.5" />
      </button>

      <Handle type="source" position={sourcePos} className="!bg-g-border !w-2 !h-2" />
    </div>
  );
}

export const SectionNode = memo(SectionNodeComponent);
