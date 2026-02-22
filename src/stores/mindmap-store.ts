import { create } from 'zustand';

interface MindMapState {
  collapsedNodes: Record<string, Set<string>>; // projectId → nodeIds
  direction: 'RIGHT' | 'DOWN';
  editingNodeId: string | null;
  addingNodeId: string | null;
  selectedNodeId: string | null;
  toggleCollapse: (projectId: string, nodeId: string) => void;
  expandAll: (projectId: string) => void;
  collapseAll: (projectId: string, nodeIds: string[]) => void;
  setDirection: (d: 'RIGHT' | 'DOWN') => void;
  isCollapsed: (projectId: string, nodeId: string) => boolean;
  setEditingNodeId: (id: string | null) => void;
  setAddingNodeId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  clearInteraction: () => void;
}

export const useMindMapStore = create<MindMapState>((set, get) => ({
  collapsedNodes: {},
  direction: 'RIGHT',
  editingNodeId: null,
  addingNodeId: null,
  selectedNodeId: null,

  toggleCollapse: (projectId, nodeId) =>
    set((state) => {
      const current = new Set(state.collapsedNodes[projectId] ?? []);
      if (current.has(nodeId)) {
        current.delete(nodeId);
      } else {
        current.add(nodeId);
      }
      return { collapsedNodes: { ...state.collapsedNodes, [projectId]: current } };
    }),

  expandAll: (projectId) =>
    set((state) => ({
      collapsedNodes: { ...state.collapsedNodes, [projectId]: new Set<string>() },
    })),

  collapseAll: (projectId, nodeIds) =>
    set((state) => ({
      collapsedNodes: { ...state.collapsedNodes, [projectId]: new Set(nodeIds) },
    })),

  setDirection: (d) => set({ direction: d }),

  setEditingNodeId: (id) => set({ editingNodeId: id, addingNodeId: null }),

  setAddingNodeId: (id) => set({ addingNodeId: id, editingNodeId: null }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  clearInteraction: () => set({ editingNodeId: null, addingNodeId: null }),

  isCollapsed: (projectId, nodeId) => {
    return get().collapsedNodes[projectId]?.has(nodeId) ?? false;
  },
}));
