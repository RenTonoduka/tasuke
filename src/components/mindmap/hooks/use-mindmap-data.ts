import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Section, Task } from '@/types';
import { sectionsToTree, filterCollapsed, insertSubtasks, type MindMapTreeNode } from '@/lib/mindmap-utils';
import { useMindMapStore } from '@/stores/mindmap-store';
import { useMindMapLayout } from './use-mindmap-layout';

export function useMindMapData(
  sections: Section[],
  projectId: string,
  projectName: string,
  projectColor: string,
  onRefetch?: () => void
) {
  const { collapsedNodes, direction, editingNodeId, addingNodeId } = useMindMapStore();
  const collapsed = collapsedNodes[projectId] ?? new Set<string>();

  const [subtasksMap, setSubtasksMap] = useState<Record<string, Task[]>>({});
  const [loadingSubtasks, setLoadingSubtasks] = useState<Set<string>>(new Set());

  // sections が変わったら subtasksMap をリセット（古いキャッシュ防止）
  const prevSectionsRef = useRef(sections);
  useEffect(() => {
    if (prevSectionsRef.current !== sections) {
      prevSectionsRef.current = sections;
      setSubtasksMap({});
    }
  }, [sections]);

  // onRefetch を ref で保持（useMemo の deps に入れない）
  const onRefetchRef = useRef(onRefetch);
  onRefetchRef.current = onRefetch;
  const stableOnRefetch = useCallback(() => {
    onRefetchRef.current?.();
  }, []);

  // ツリー構築
  const fullTree = useMemo(() => {
    let tree = sectionsToTree(projectName, projectColor, sections);
    for (const [taskId, subtasks] of Object.entries(subtasksMap)) {
      tree = insertSubtasks(tree, taskId, subtasks);
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

  // layoutNodes を Map に変換
  const layoutMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of layoutNodes) {
      map.set(n.id, { x: n.x, y: n.y });
    }
    return map;
  }, [layoutNodes]);

  // React Flow ノード生成（onRefetch を直接注入）
  const nodes: Node[] = useMemo(() => {
    const flatNodes: MindMapTreeNode[] = [];

    function flatten(node: MindMapTreeNode) {
      flatNodes.push(node);
      for (const child of node.children) {
        flatten(child);
      }
    }
    flatten(visibleTree);

    return flatNodes.map((node) => {
      const pos = layoutMap.get(node.id);
      return {
        id: node.id,
        type: node.type === 'root' ? 'rootNode' : node.type === 'section' ? 'sectionNode' : 'taskNode',
        position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
        data: {
          ...node.data,
          label: node.label,
          projectId,
          isEditing: editingNodeId === node.id,
          isAdding: addingNodeId === node.id,
          onRefetch: stableOnRefetch,
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
  }, [visibleTree, layoutMap, collapsed, subtasksMap, loadingSubtasks, projectId, editingNodeId, addingNodeId, stableOnRefetch]);

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

  // ref で最新 state を追跡
  const subtasksMapRef = useRef(subtasksMap);
  subtasksMapRef.current = subtasksMap;
  const loadingRef = useRef(loadingSubtasks);
  loadingRef.current = loadingSubtasks;

  // サブタスク遅延ロード
  const loadSubtasks = useCallback(async (taskId: string) => {
    if (subtasksMapRef.current[taskId] || loadingRef.current.has(taskId)) return;

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
  }, []);

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
