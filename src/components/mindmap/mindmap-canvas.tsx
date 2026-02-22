'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import type { Node, Edge } from '@xyflow/react';
import type { NavInfo } from '@/lib/mindmap-utils';

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
  navMap: Map<string, NavInfo>;
  onLoadSubtasks: (taskId: string) => void;
  onRefetch?: () => void;
}

export function MindMapCanvas({ nodes, edges, projectId, navMap, onLoadSubtasks, onRefetch }: MindMapCanvasProps) {
  const openPanel = useTaskPanelStore((s) => s.open);
  const toggleCollapse = useMindMapStore((s) => s.toggleCollapse);
  const setEditingNodeId = useMindMapStore((s) => s.setEditingNodeId);
  const setAddingNodeId = useMindMapStore((s) => s.setAddingNodeId);
  const setSelectedNodeId = useMindMapStore((s) => s.setSelectedNodeId);
  const clearInteraction = useMindMapStore((s) => s.clearInteraction);

  const { getNodes, getZoom, setCenter } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ダブルクリック検出用タイマー
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DOUBLE_CLICK_DELAY = 250;

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // 編集/追加中なら解除し、クリックしたノードを選択
      const { editingNodeId, addingNodeId } = useMindMapStore.getState();
      if (editingNodeId || addingNodeId) {
        clearInteraction();
        setSelectedNodeId(node.id);
        return;
      }

      // 選択状態を設定（root 含む全ノード）
      setSelectedNodeId(node.id);

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
    [projectId, toggleCollapse, openPanel, onLoadSubtasks, clearInteraction, setSelectedNodeId]
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
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

  // 背景クリック → 全解除（選択も含む）
  const handlePaneClick = useCallback(() => {
    clearInteraction();
    setSelectedNodeId(null);
  }, [clearInteraction, setSelectedNodeId]);

  // navMap を ref で保持（useEffect 内で最新値を参照するため）
  const navMapRef = useRef(navMap);
  navMapRef.current = navMap;

  // キーボードショートカット（document レベルで捕捉）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // マインドマップコンテナ外のイベントは無視
      if (!containerRef.current?.contains(e.target as HTMLElement)) return;

      // input/textarea/contentEditable 内の入力は無視
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;

      const { selectedNodeId, editingNodeId, addingNodeId, direction } = useMindMapStore.getState();

      // 編集/追加中はショートカット無効
      if (editingNodeId || addingNodeId) return;

      // 矢印キー: 未選択時は root を選択
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (!selectedNodeId) {
          setSelectedNodeId('root');
          return;
        }
        const nav = navMapRef.current.get(selectedNodeId);
        if (!nav) return;

        const toChild = direction === 'RIGHT' ? 'ArrowRight' : 'ArrowDown';
        const toParent = direction === 'RIGHT' ? 'ArrowLeft' : 'ArrowUp';
        const toNext = direction === 'RIGHT' ? 'ArrowDown' : 'ArrowRight';
        const toPrev = direction === 'RIGHT' ? 'ArrowUp' : 'ArrowLeft';

        let target: string | null = null;
        if (e.key === toChild) target = nav.firstChild;
        if (e.key === toParent) target = nav.parent;
        if (e.key === toNext) target = nav.nextSibling;
        if (e.key === toPrev) target = nav.prevSibling;

        if (target) {
          setSelectedNodeId(target);
          const targetNode = getNodes().find((n) => n.id === target);
          if (targetNode) {
            const zoom = getZoom();
            setCenter(
              targetNode.position.x + (targetNode.measured?.width ?? 180) / 2,
              targetNode.position.y + (targetNode.measured?.height ?? 40) / 2,
              { zoom, duration: 200 }
            );
          }
        }
        return;
      }

      if (!selectedNodeId) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        if (selectedNodeId === 'root') return;
        setAddingNodeId(selectedNodeId);
      }

      if (e.key === 'F2') {
        e.preventDefault();
        if (selectedNodeId === 'root') return;
        setEditingNodeId(selectedNodeId);
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedNodeId === 'root') return;
        setDeleteTarget(selectedNodeId);
      }

      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [getNodes, getZoom, setCenter, setAddingNodeId, setEditingNodeId, setSelectedNodeId]);

  // 削除実行
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      let res: Response;
      if (deleteTarget.startsWith('task-')) {
        const taskId = deleteTarget.replace('task-', '');
        res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      } else if (deleteTarget.startsWith('section-')) {
        const sectionId = deleteTarget.replace('section-', '');
        res = await fetch(`/api/sections/${sectionId}`, { method: 'DELETE' });
      } else {
        return;
      }
      if (!res.ok) {
        console.error('削除失敗:', res.status);
        return;
      }
      setSelectedNodeId(null);
      onRefetch?.();
    } catch (err) {
      console.error('削除エラー:', err);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, setSelectedNodeId, onRefetch]);

  const deleteLabel = deleteTarget?.startsWith('section-') ? 'セクション' : 'タスク';

  return (
    <>
      <div ref={containerRef} className="h-full w-full">
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
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteLabel}を削除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.startsWith('section-')
                ? 'このセクションを削除しますか？含まれるタスクも削除されます。この操作は取り消せません。'
                : 'このタスクを削除しますか？この操作は取り消せません。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#EA4335] hover:bg-red-600"
              onClick={handleDelete}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
