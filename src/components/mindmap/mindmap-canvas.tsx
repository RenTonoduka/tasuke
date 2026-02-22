'use client';

import { useCallback, useRef } from 'react';
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
}

export function MindMapCanvas({ nodes, edges, projectId, onLoadSubtasks }: MindMapCanvasProps) {
  const openPanel = useTaskPanelStore((s) => s.open);
  const toggleCollapse = useMindMapStore((s) => s.toggleCollapse);
  const setEditingNodeId = useMindMapStore((s) => s.setEditingNodeId);
  const clearInteraction = useMindMapStore((s) => s.clearInteraction);

  // ダブルクリック検出用タイマー
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DOUBLE_CLICK_DELAY = 250;

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // 編集/追加中なら解除（保存は blur で処理）
      const { editingNodeId, addingNodeId } = useMindMapStore.getState();
      if (editingNodeId || addingNodeId) {
        clearInteraction();
        return;
      }

      if (node.id === 'root') return;

      // ダブルクリック干渉回避: シングルクリックを遅延実行
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        return; // ダブルクリックの2回目 → 無視
      }

      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;

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
      }, DOUBLE_CLICK_DELAY);
    },
    [projectId, toggleCollapse, openPanel, onLoadSubtasks, clearInteraction]
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // タイマーキャンセル（シングルクリック動作を止める）
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      if (node.id === 'root') return;

      if (node.id.startsWith('task-') || node.id.startsWith('section-')) {
        setEditingNodeId(node.id);
      }
    },
    [setEditingNodeId]
  );

  // 背景クリック → 編集/追加解除
  const handlePaneClick = useCallback(() => {
    clearInteraction();
  }, [clearInteraction]);

  return (
    <ReactFlow
      nodes={nodes}
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
  );
}
