import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Section, Task } from '@/types';
import { sectionsToTree, filterCollapsed, insertSubtasks, buildNavMap, PRIORITY_COLORS, type MindMapTreeNode } from '@/lib/mindmap-utils';
import { useMindMapStore } from '@/stores/mindmap-store';
import { useMindMapLayout } from './use-mindmap-layout';

export function useMindMapData(
  sections: Section[],
  projectId: string,
  projectName: string,
  projectColor: string,
  onRefetch?: () => void
) {
  const { collapsedNodes, direction, editingNodeId, addingNodeId, selectedNodeId } = useMindMapStore();
  const collapsed = collapsedNodes[projectId] ?? new Set<string>();

  const [subtasksMap, setSubtasksMap] = useState<Record<string, Task[]>>({});
  const [loadingSubtasks, setLoadingSubtasks] = useState<Set<string>>(new Set());
  const subtasksMapRef = useRef(subtasksMap);
  subtasksMapRef.current = subtasksMap;

  // sections が変わったらロード済みサブタスクを再取得（全消去ではなく更新）
  const prevSectionsRef = useRef(sections);
  useEffect(() => {
    if (prevSectionsRef.current !== sections) {
      prevSectionsRef.current = sections;
      const loadedTaskIds = Object.keys(subtasksMapRef.current);
      if (loadedTaskIds.length === 0) return;
      for (const taskId of loadedTaskIds) {
        fetch(`/api/tasks/${taskId}/subtasks`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) {
              setSubtasksMap((prev) => ({ ...prev, [taskId]: data }));
            } else {
              setSubtasksMap((prev) => {
                const { [taskId]: _, ...rest } = prev;
                return rest;
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [sections]);

  // onRefetch を ref で保持（useMemo の deps に入れない）
  const onRefetchRef = useRef(onRefetch);
  onRefetchRef.current = onRefetch;
  const stableOnRefetch = useCallback(() => {
    onRefetchRef.current?.();
  }, []);

  // サブタスク作成後: sections 再取得 + 親タスクのサブタスクを即時ロード
  const onSubtaskCreated = useCallback(async (parentTaskId: string) => {
    onRefetchRef.current?.();
    try {
      const res = await fetch(`/api/tasks/${parentTaskId}/subtasks`);
      if (res.ok) {
        const data = await res.json();
        setSubtasksMap((prev) => ({ ...prev, [parentTaskId]: data }));
      }
    } catch {}
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
          isSelected: selectedNodeId === node.id,
          onRefetch: stableOnRefetch,
          onSubtaskCreated,
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
  }, [visibleTree, layoutMap, collapsed, subtasksMap, loadingSubtasks, projectId, editingNodeId, addingNodeId, selectedNodeId, stableOnRefetch, onSubtaskCreated]);

  // React Flow エッジ生成
  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];

    function traverse(node: MindMapTreeNode) {
      for (const child of node.children) {
        let edgeColor: string | undefined;
        if (child.type === 'task' && child.data.task) {
          edgeColor = PRIORITY_COLORS[child.data.task.priority];
        } else if (node.type === 'task' && node.data.task) {
          edgeColor = PRIORITY_COLORS[node.data.task.priority];
        }

        result.push({
          id: `${node.id}->${child.id}`,
          source: node.id,
          target: child.id,
          type: 'mindmapEdge',
          data: edgeColor ? { color: edgeColor } : {},
        });
        traverse(child);
      }
    }
    traverse(visibleTree);

    return result;
  }, [visibleTree]);

  // ref で最新 state を追跡
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

  // ナビゲーションマップ（矢印キー移動用）
  const navMap = useMemo(() => buildNavMap(visibleTree), [visibleTree]);

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

  return { nodes, edges, loadSubtasks, allNodeIds, navMap };
}
