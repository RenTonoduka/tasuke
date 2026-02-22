'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { Network } from 'lucide-react';
import { MindMapCanvas } from './mindmap-canvas';
import { MindMapToolbar } from './controls/mindmap-toolbar';
import { useMindMapData } from './hooks/use-mindmap-data';
import type { Section } from '@/types';

interface MindMapViewProps {
  sections: Section[];
  projectId: string;
  projectName: string;
  projectColor?: string;
  onRefetch?: () => void;
}

export function MindMapView({ sections, projectId, projectName, projectColor = '#4285F4', onRefetch }: MindMapViewProps) {
  const hasTasks = sections.some((s) => s.tasks.length > 0);

  const { nodes, edges, loadSubtasks, allNodeIds } = useMindMapData(
    sections,
    projectId,
    projectName,
    projectColor,
    onRefetch
  );

  if (!hasTasks) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-g-text-muted">
        <Network className="h-12 w-12 opacity-30" />
        <p className="text-sm">タスクを追加するとマインドマップが表示されます</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-1 flex-col overflow-hidden">
        <MindMapToolbar projectId={projectId} projectName={projectName} allNodeIds={allNodeIds} />
        <div className="flex-1">
          <MindMapCanvas
            nodes={nodes}
            edges={edges}
            projectId={projectId}
            onLoadSubtasks={loadSubtasks}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
