import type { Section, Task } from '@/types';

export const PRIORITY_COLORS: Record<string, string> = {
  P0: '#EA4335',
  P1: '#FBBC04',
  P2: '#4285F4',
  P3: '#80868B',
};

export interface MindMapTreeNode {
  id: string;
  type: 'root' | 'section' | 'task';
  label: string;
  data: {
    projectName?: string;
    projectColor?: string;
    sectionId?: string;
    sectionName?: string;
    taskCount?: number;
    task?: Task;
    subtaskCount?: number;
  };
  children: MindMapTreeNode[];
}

/**
 * Section[] → MindMapTreeNode ツリーに変換
 */
export function sectionsToTree(
  projectName: string,
  projectColor: string,
  sections: Section[]
): MindMapTreeNode {
  return {
    id: 'root',
    type: 'root',
    label: projectName,
    data: { projectName, projectColor },
    children: sections.map((section) => ({
      id: `section-${section.id}`,
      type: 'section' as const,
      label: section.name,
      data: { sectionId: section.id, sectionName: section.name, taskCount: section.tasks.length },
      children: section.tasks.map((task) => taskToTreeNode(task)),
    })),
  };
}

function taskToTreeNode(task: Task): MindMapTreeNode {
  return {
    id: `task-${task.id}`,
    type: 'task',
    label: task.title,
    data: {
      task,
      subtaskCount: task._count?.subtasks ?? 0,
    },
    children: [],
  };
}

/**
 * 折りたたみ状態を適用して可視ノードのみに絞る
 */
export function filterCollapsed(
  node: MindMapTreeNode,
  collapsedIds: Set<string>
): MindMapTreeNode {
  if (collapsedIds.has(node.id)) {
    return { ...node, children: [] };
  }
  return {
    ...node,
    children: node.children.map((child) => filterCollapsed(child, collapsedIds)),
  };
}

/**
 * サブタスクデータをツリーに挿入する
 */
export function insertSubtasks(
  root: MindMapTreeNode,
  parentTaskId: string,
  subtasks: Task[]
): MindMapTreeNode {
  const targetId = `task-${parentTaskId}`;

  function traverse(node: MindMapTreeNode): MindMapTreeNode {
    if (node.id === targetId) {
      return {
        ...node,
        children: subtasks.map((st) => taskToTreeNode(st)),
      };
    }
    return {
      ...node,
      children: node.children.map(traverse),
    };
  }

  return traverse(root);
}
