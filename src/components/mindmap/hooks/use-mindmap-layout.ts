import { useMemo } from 'react';
import { flextree } from 'd3-flextree';
import type { MindMapTreeNode } from '@/lib/mindmap-utils';

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_SIZES: Record<string, [number, number]> = {
  root: [200, 56],
  section: [180, 48],
  task: [220, 64],
};

const SPACING_H = 60;
const SPACING_V = 20;

export function useMindMapLayout(
  tree: MindMapTreeNode,
  direction: 'RIGHT' | 'DOWN'
) {
  return useMemo(() => {
    const layout = flextree<MindMapTreeNode>({
      nodeSize: (node) => {
        const [w, h] = NODE_SIZES[node.data.type] ?? [200, 56];
        if (direction === 'RIGHT') {
          return [h + SPACING_V, w + SPACING_H];
        }
        return [w + SPACING_H, h + SPACING_V];
      },
    });

    const hierarchy = layout.hierarchy(tree, (d) => d.children);
    const computed = layout(hierarchy);
    const nodes: LayoutNode[] = [];

    computed.each((node) => {
      const [w, h] = NODE_SIZES[node.data.type] ?? [200, 56];
      if (direction === 'RIGHT') {
        nodes.push({
          id: node.data.id,
          x: node.y,
          y: node.x,
          width: w,
          height: h,
        });
      } else {
        nodes.push({
          id: node.data.id,
          x: node.x,
          y: node.y,
          width: w,
          height: h,
        });
      }
    });

    return nodes;
  }, [tree, direction]);
}
