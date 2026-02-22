'use client';

import { useReactFlow } from '@xyflow/react';
import { Maximize2, ChevronsRight, ChevronsDown, Expand, Shrink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMindMapStore } from '@/stores/mindmap-store';

interface MindMapToolbarProps {
  projectId: string;
  allNodeIds: string[];
}

export function MindMapToolbar({ projectId, allNodeIds }: MindMapToolbarProps) {
  const { fitView } = useReactFlow();
  const { direction, setDirection, expandAll, collapseAll } = useMindMapStore();

  return (
    <div className="flex items-center gap-1 border-b border-g-border bg-g-bg px-4 py-1.5">
      <span className="text-xs text-g-text-muted mr-2">マインドマップ</span>

      {/* 方向切替 */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setDirection(direction === 'RIGHT' ? 'DOWN' : 'RIGHT')}
      >
        {direction === 'RIGHT' ? (
          <><ChevronsRight className="h-3.5 w-3.5" /> 横</>
        ) : (
          <><ChevronsDown className="h-3.5 w-3.5" /> 縦</>
        )}
      </Button>

      {/* 全展開 */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => expandAll(projectId)}
      >
        <Expand className="h-3.5 w-3.5" />
        全展開
      </Button>

      {/* 全折りたたみ */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => collapseAll(projectId, allNodeIds)}
      >
        <Shrink className="h-3.5 w-3.5" />
        折りたたみ
      </Button>

      {/* フィット */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => fitView({ padding: 0.3 })}
      >
        <Maximize2 className="h-3.5 w-3.5" />
        フィット
      </Button>
    </div>
  );
}
