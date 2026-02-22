import { create } from 'zustand';

interface MindMapState {
  collapsedNodes: Record<string, Set<string>>; // projectId → nodeIds
  direction: 'RIGHT' | 'DOWN';
  toggleCollapse: (projectId: string, nodeId: string) => void;
  expandAll: (projectId: string) => void;
  collapseAll: (projectId: string, nodeIds: string[]) => void;
  setDirection: (d: 'RIGHT' | 'DOWN') => void;
  isCollapsed: (projectId: string, nodeId: string) => boolean;
}

export const useMindMapStore = create<MindMapState>((set, get) => ({
  collapsedNodes: {},
  direction: 'RIGHT',

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

  isCollapsed: (projectId, nodeId) => {
    return get().collapsedNodes[projectId]?.has(nodeId) ?? false;
  },
}));
