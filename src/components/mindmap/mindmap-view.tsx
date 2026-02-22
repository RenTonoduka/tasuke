'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { MindMapCanvas } from './mindmap-canvas';
import { MindMapToolbar } from './controls/mindmap-toolbar';
import { useMindMapData } from './hooks/use-mindmap-data';
import type { Section } from '@/types';

interface MindMapViewProps {
  sections: Section[];
  projectId: string;
  projectName: string;
  projectColor?: string;
}

export function MindMapView({ sections, projectId, projectName, projectColor = '#4285F4' }: MindMapViewProps) {
  const { nodes, edges, loadSubtasks, allNodeIds } = useMindMapData(
    sections,
    projectId,
    projectName,
    projectColor
  );

  return (
    <ReactFlowProvider>
      <div className="flex flex-1 flex-col overflow-hidden">
        <MindMapToolbar projectId={projectId} allNodeIds={allNodeIds} />
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
