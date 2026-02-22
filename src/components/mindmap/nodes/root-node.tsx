import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { useMindMapStore } from '@/stores/mindmap-store';

type RootNodeData = {
  label: string;
  projectColor?: string;
  [key: string]: unknown;
};

type RootNodeType = Node<RootNodeData, 'rootNode'>;

function RootNodeComponent({ data }: NodeProps<RootNodeType>) {
  const direction = useMindMapStore((s) => s.direction);
  const handlePos = direction === 'RIGHT' ? Position.Right : Position.Bottom;

  return (
    <div
      className="flex items-center justify-center rounded-xl px-6 py-3 shadow-md"
      style={{
        backgroundColor: data.projectColor ?? '#4285F4',
        minWidth: 200,
      }}
    >
      <span className="text-sm font-bold text-white">{data.label}</span>
      <Handle type="source" position={handlePos} className="!bg-white/50 !w-2 !h-2" />
    </div>
  );
}

export const RootNode = memo(RootNodeComponent);
