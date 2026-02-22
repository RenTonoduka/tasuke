'use client';

import { useState, useCallback } from 'react';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { Maximize2, ChevronsRight, ChevronsDown, Expand, Shrink, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMindMapStore } from '@/stores/mindmap-store';

interface MindMapToolbarProps {
  projectId: string;
  projectName: string;
  allNodeIds: string[];
}

export function MindMapToolbar({ projectId, projectName, allNodeIds }: MindMapToolbarProps) {
  const { fitView, getNodes } = useReactFlow();
  const { direction, setDirection, expandAll, collapseAll } = useMindMapStore();
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const nodes = getNodes();
      if (nodes.length === 0) return;

      const bounds = getNodesBounds(nodes);
      const padding = 50;
      const imageWidth = bounds.width + padding * 2;
      const imageHeight = bounds.height + padding * 2;
      const viewport = getViewportForBounds(bounds, imageWidth, imageHeight, 0.5, 2, padding);

      const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewportEl) return;

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--g-bg').trim() || '#ffffff',
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      const link = document.createElement('a');
      link.download = `${projectName}-mindmap.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('エクスポートエラー:', err);
    } finally {
      setExporting(false);
    }
  }, [getNodes, projectName]);

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

      {/* エクスポート */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        PNG
      </Button>
    </div>
  );
}
