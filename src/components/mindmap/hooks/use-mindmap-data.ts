import { useMemo, useState, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Section, Task } from '@/types';
import { sectionsToTree, filterCollapsed, insertSubtasks, type MindMapTreeNode } from '@/lib/mindmap-utils';
import { useMindMapStore } from '@/stores/mindmap-store';
import { useMindMapLayout } from './use-mindmap-layout';

export function useMindMapData(
  sections: Section[],
  projectId: string,
  projectName: string,
  projectColor: string
) {
  const { collapsedNodes, direction } = useMindMapStore();
  const collapsed = collapsedNodes[projectId] ?? new Set<string>();

  const [subtasksMap, setSubtasksMap] = useState<Record<string, Task[]>>({});
  const [loadingSubtasks, setLoadingSubtasks] = useState<Set<string>>(new Set());

  // ツリー構築
  const fullTree = useMemo(() => {
    const tree = sectionsToTree(projectName, projectColor, sections);
    // ロード済みサブタスクを挿入
    for (const [taskId, subtasks] of Object.entries(subtasksMap)) {
      Object.assign(tree, insertSubtasks(tree, taskId, subtasks));
    }
    return tree;
  }, [projectName, projectColor, sections, subtasksMap]);

  // 折りたたみ適用
  const visibleTree = useMemo(
    () => filterCollapsed(fullTree, collapsed),
    [fullTree, collapsed]
  );

  // レイアウト計算
  const layoutNodes = useMindMapLayout(visibleTree, direction);

  // React Flow ノード生成
  const nodes: Node[] = useMemo(() => {
    const flatNodes: { node: MindMapTreeNode; parentId?: string }[] = [];

    function flatten(node: MindMapTreeNode, parentId?: string) {
      flatNodes.push({ node, parentId });
      for (const child of node.children) {
        flatten(child, node.id);
      }
    }
    flatten(visibleTree);

    return flatNodes.map(({ node }) => {
      const pos = layoutNodes.find((l) => l.id === node.id);
      return {
        id: node.id,
        type: node.type === 'root' ? 'rootNode' : node.type === 'section' ? 'sectionNode' : 'taskNode',
        position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
        data: {
          ...node.data,
          label: node.label,
          hasChildren: node.type === 'section'
            ? (node.data.taskCount ?? 0) > 0
            : (node.data.subtaskCount ?? 0) > 0,
          childrenLoaded: node.type === 'task' && node.data.task
            ? !!subtasksMap[node.data.task.id]
            : true,
          isCollapsed: collapsed.has(node.id),
          childCount: node.type === 'section'
            ? node.data.taskCount ?? 0
            : node.data.subtaskCount ?? 0,
          isLoading: node.type === 'task' && node.data.task
            ? loadingSubtasks.has(node.data.task.id)
            : false,
        },
      };
    });
  }, [visibleTree, layoutNodes, collapsed, subtasksMap, loadingSubtasks]);

  // React Flow エッジ生成
  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];

    function traverse(node: MindMapTreeNode) {
      for (const child of node.children) {
        result.push({
          id: `${node.id}->${child.id}`,
          source: node.id,
          target: child.id,
          type: 'mindmapEdge',
        });
        traverse(child);
      }
    }
    traverse(visibleTree);

    return result;
  }, [visibleTree]);

  // サブタスク遅延ロード
  const loadSubtasks = useCallback(async (taskId: string) => {
    if (subtasksMap[taskId] || loadingSubtasks.has(taskId)) return;
    setLoadingSubtasks((prev) => new Set(prev).add(taskId));
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`);
      if (res.ok) {
        const data = await res.json();
        setSubtasksMap((prev) => ({ ...prev, [taskId]: data }));
      }
    } finally {
      setLoadingSubtasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [subtasksMap, loadingSubtasks]);

  // 全ノードIDの収集（collapseAll用）
  const allNodeIds = useMemo(() => {
    const ids: string[] = [];
    function collect(node: MindMapTreeNode) {
      if (node.children.length > 0) ids.push(node.id);
      node.children.forEach(collect);
    }
    collect(fullTree);
    return ids;
  }, [fullTree]);

  return { nodes, edges, loadSubtasks, allNodeIds };
}
