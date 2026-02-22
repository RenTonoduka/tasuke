'use client';

import { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { RootNode } from './nodes/root-node';
import { SectionNode } from './nodes/section-node';
import { TaskNode } from './nodes/task-node';
import { MindMapEdge } from './edges/mindmap-edge';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { useMindMapStore } from '@/stores/mindmap-store';
import type { Node, Edge } from '@xyflow/react';

const nodeTypes = {
  rootNode: RootNode,
  sectionNode: SectionNode,
  taskNode: TaskNode,
};

const edgeTypes = {
  mindmapEdge: MindMapEdge,
};

interface MindMapCanvasProps {
  nodes: Node[];
  edges: Edge[];
  projectId: string;
  onLoadSubtasks: (taskId: string) => void;
}

export function MindMapCanvas({ nodes, edges, projectId, onLoadSubtasks }: MindMapCanvasProps) {
  const openPanel = useTaskPanelStore((s) => s.open);
  const toggleCollapse = useMindMapStore((s) => s.toggleCollapse);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.id === 'root') return;

      if (node.id.startsWith('section-')) {
        toggleCollapse(projectId, node.id);
        return;
      }

      if (node.id.startsWith('task-')) {
        const taskId = node.id.replace('task-', '');
        const data = node.data as Record<string, unknown>;

        // サブタスクがあり、まだロードされていない場合はロードして展開
        if (data.hasChildren && !data.childrenLoaded && !data.isLoading) {
          onLoadSubtasks(taskId);
          return;
        }

        // 子ノードがある場合は折りたたみ切り替え
        if (data.hasChildren && data.childrenLoaded) {
          toggleCollapse(projectId, node.id);
          return;
        }

        // 子ノードがない場合はタスク詳細を開く
        openPanel(taskId);
      }
    },
    [projectId, toggleCollapse, openPanel, onLoadSubtasks]
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.id.startsWith('task-')) {
        const taskId = node.id.replace('task-', '');
        openPanel(taskId);
      }
    },
    [openPanel]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--g-border)" />
      <Controls showInteractive={false} className="!bg-g-bg !border-g-border !shadow-sm" />
      <MiniMap
        className="!bg-g-bg !border-g-border"
        maskColor="rgba(0,0,0,0.1)"
        nodeColor={(node) => {
          if (node.type === 'rootNode') return '#4285F4';
          if (node.type === 'sectionNode') return 'var(--g-surface)';
          return 'var(--g-bg)';
        }}
      />
    </ReactFlow>
  );
}
