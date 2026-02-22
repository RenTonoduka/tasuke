import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useMindMapStore } from '@/stores/mindmap-store';

type SectionNodeData = {
  label: string;
  taskCount?: number;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  [key: string]: unknown;
};

type SectionNodeType = Node<SectionNodeData, 'sectionNode'>;

function SectionNodeComponent({ data }: NodeProps<SectionNodeType>) {
  const direction = useMindMapStore((s) => s.direction);
  const sourcePos = direction === 'RIGHT' ? Position.Right : Position.Bottom;
  const targetPos = direction === 'RIGHT' ? Position.Left : Position.Top;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-g-border bg-g-surface px-4 py-2.5 shadow-sm"
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

      {data.hasChildren && (
        <Handle type="source" position={sourcePos} className="!bg-g-border !w-2 !h-2" />
      )}
    </div>
  );
}

export const SectionNode = memo(SectionNodeComponent);
