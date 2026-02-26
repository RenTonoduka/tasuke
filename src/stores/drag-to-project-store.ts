import { create } from 'zustand';

interface DragToProjectStore {
  isDraggingTask: boolean;
  sourceProjectId: string | null;
  startDrag: (projectId: string) => void;
  reset: () => void;
}

export const useDragToProjectStore = create<DragToProjectStore>((set) => ({
  isDraggingTask: false,
  sourceProjectId: null,
  startDrag: (projectId) => set({ isDraggingTask: true, sourceProjectId: projectId }),
  reset: () => set({ isDraggingTask: false, sourceProjectId: null }),
}));
