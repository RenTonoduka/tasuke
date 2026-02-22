import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

function MindMapEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.3,
  });

  const color = (data as Record<string, unknown>)?.color as string | undefined;

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: color ?? 'var(--g-border)',
        strokeWidth: 1.5,
        ...style,
      }}
    />
  );
}

export const MindMapEdge = memo(MindMapEdgeComponent);
