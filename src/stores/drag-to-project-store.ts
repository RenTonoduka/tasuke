import { create } from 'zustand';

interface DragToProjectStore {
  isDraggingTask: boolean;
  hoveredProjectId: string | null;
  sourceProjectId: string | null;
  setDraggingTask: (v: boolean) => void;
  setHoveredProjectId: (id: string | null) => void;
  setSourceProjectId: (id: string | null) => void;
  reset: () => void;
}

export const useDragToProjectStore = create<DragToProjectStore>((set) => ({
  isDraggingTask: false,
  hoveredProjectId: null,
  sourceProjectId: null,
  setDraggingTask: (v) => set({ isDraggingTask: v }),
  setHoveredProjectId: (id) => set({ hoveredProjectId: id }),
  setSourceProjectId: (id) => set({ sourceProjectId: id }),
  reset: () => set({ isDraggingTask: false, hoveredProjectId: null, sourceProjectId: null }),
}));
