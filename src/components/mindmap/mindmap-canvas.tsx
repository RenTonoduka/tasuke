'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
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
  onRefetch?: () => void;
}

export function MindMapCanvas({ nodes, edges, projectId, onLoadSubtasks, onRefetch }: MindMapCanvasProps) {
  const openPanel = useTaskPanelStore((s) => s.open);
  const toggleCollapse = useMindMapStore((s) => s.toggleCollapse);
  const setEditingNodeId = useMindMapStore((s) => s.setEditingNodeId);
  const editingNodeId = useMindMapStore((s) => s.editingNodeId);

  // ノードデータに onRefetch コールバックを注入
  const nodesWithCallbacks = useMemo(() =>
    nodes.map((node) => ({
      ...node,
      data: { ...node.data, onRefetch },
    })),
    [nodes, onRefetch]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // 編集中のノードがあれば解除（保存は blur で処理）
      if (editingNodeId && editingNodeId !== node.id) {
        setEditingNodeId(null);
      }

      if (node.id === 'root') return;

      if (node.id.startsWith('section-')) {
        toggleCollapse(projectId, node.id);
        return;
      }

      if (node.id.startsWith('task-')) {
        const taskId = node.id.replace('task-', '');
        const data = node.data as Record<string, unknown>;

        if (data.hasChildren && !data.childrenLoaded && !data.isLoading) {
          onLoadSubtasks(taskId);
          return;
        }

        if (data.hasChildren && data.childrenLoaded) {
          toggleCollapse(projectId, node.id);
          return;
        }

        openPanel(taskId);
      }
    },
    [projectId, toggleCollapse, openPanel, onLoadSubtasks, editingNodeId, setEditingNodeId]
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.id === 'root') return;

      // ダブルクリック → 編集モード開始
      if (node.id.startsWith('task-') || node.id.startsWith('section-')) {
        setEditingNodeId(node.id);
      }
    },
    [setEditingNodeId]
  );

  // 背景クリック → 編集解除
  const handlePaneClick = useCallback(() => {
    if (editingNodeId) {
      setEditingNodeId(null);
    }
  }, [editingNodeId, setEditingNodeId]);

  // キーボードショートカット
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 編集中は無視（input 内で処理される）
      if (editingNodeId) return;

      // F2 → 選択中ノードの編集（React Flow の選択状態は使わず、最後にクリックしたノードを対象にする簡易実装）
      // Tab / Enter / Delete は将来の拡張ポイント
    },
    [editingNodeId]
  );

  return (
    <div onKeyDown={handleKeyDown} className="h-full w-full">
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.1}
        maxZoom={2}
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
    </div>
  );
}
