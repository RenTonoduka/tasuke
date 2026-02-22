import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useMindMapStore } from '@/stores/mindmap-store';

interface SectionNodeData {
  label: string;
  taskCount?: number;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  nodeId?: string;
  projectId?: string;
}

function SectionNodeComponent({ id, data }: NodeProps) {
  const d = data as unknown as SectionNodeData;
  const direction = useMindMapStore((s) => s.direction);
  const sourcePos = direction === 'RIGHT' ? Position.Right : Position.Bottom;
  const targetPos = direction === 'RIGHT' ? Position.Left : Position.Top;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-g-border bg-g-surface px-4 py-2.5 shadow-sm"
      style={{ minWidth: 180 }}
    >
      <Handle type="target" position={targetPos} className="!bg-g-border !w-2 !h-2" />

      {d.hasChildren && (
        <span className="text-g-text-secondary">
          {d.isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      )}

      <span className="truncate text-xs font-semibold text-g-text">{d.label}</span>

      <span className="ml-auto rounded-full bg-g-border px-1.5 py-0.5 text-[10px] text-g-text-secondary">
        {d.taskCount ?? 0}
      </span>

      {d.hasChildren && (
        <Handle type="source" position={sourcePos} className="!bg-g-border !w-2 !h-2" />
      )}
    </div>
  );
}

export const SectionNode = memo(SectionNodeComponent);
