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

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: 'var(--g-border)',
        strokeWidth: 1.5,
        ...style,
      }}
    />
  );
}

export const MindMapEdge = memo(MindMapEdgeComponent);
