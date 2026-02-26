import { create } from 'zustand';

interface DragToProjectStore {
  isDraggingTask: boolean;
  sourceProjectId: string | null;
  reset: () => void;
}

export const useDragToProjectStore = create<DragToProjectStore>((set) => ({
  isDraggingTask: false,
  sourceProjectId: null,
  reset: () => set({ isDraggingTask: false, sourceProjectId: null }),
}));
