import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronRight, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react';
import { useMindMapStore } from '@/stores/mindmap-store';
import type { Task } from '@/types';

const priorityColors: Record<string, string> = {
  P0: '#EA4335',
  P1: '#FBBC04',
  P2: '#4285F4',
  P3: '#80868B',
};

type TaskNodeData = {
  label: string;
  task?: Task;
  hasChildren?: boolean;
  childrenLoaded?: boolean;
  isCollapsed?: boolean;
  childCount?: number;
  isLoading?: boolean;
  subtaskCount?: number;
  [key: string]: unknown;
};

type TaskNodeType = Node<TaskNodeData, 'taskNode'>;

function TaskNodeComponent({ data }: NodeProps<TaskNodeType>) {
  const direction = useMindMapStore((s) => s.direction);
  const sourcePos = direction === 'RIGHT' ? Position.Right : Position.Bottom;
  const targetPos = direction === 'RIGHT' ? Position.Left : Position.Top;
  const task = data.task;
  const isDone = task?.status === 'DONE';

  return (
    <div
      className="relative flex items-center gap-2 rounded-lg border border-g-border bg-g-bg px-3 py-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      style={{ minWidth: 220, maxWidth: 220 }}
      title={data.label}
    >
      <Handle type="target" position={targetPos} className="!bg-g-border !w-2 !h-2" />

      {task && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ backgroundColor: priorityColors[task.priority] ?? '#80868B' }}
        />
      )}

      {isDone ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#34A853]" />
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

      {data.hasChildren && (
        <Handle type="source" position={sourcePos} className="!bg-g-border !w-2 !h-2" />
      )}
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
