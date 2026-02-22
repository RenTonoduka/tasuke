import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useMindMapStore } from '@/stores/mindmap-store';

interface RootNodeData {
  label: string;
  projectColor?: string;
}

function RootNodeComponent({ data }: NodeProps) {
  const d = data as unknown as RootNodeData;
  const direction = useMindMapStore((s) => s.direction);
  const handlePos = direction === 'RIGHT' ? Position.Right : Position.Bottom;

  return (
    <div
      className="flex items-center justify-center rounded-xl px-6 py-3 shadow-md"
      style={{
        backgroundColor: d.projectColor ?? '#4285F4',
        minWidth: 200,
      }}
    >
      <span className="text-sm font-bold text-white">{d.label}</span>
      <Handle type="source" position={handlePos} className="!bg-white/50 !w-2 !h-2" />
    </div>
  );
}

export const RootNode = memo(RootNodeComponent);
