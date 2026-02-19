import { create } from 'zustand';

interface TaskPanelStore {
  activeTaskId: string | null;
  open: (taskId: string) => void;
  close: () => void;
}

export const useTaskPanelStore = create<TaskPanelStore>((set) => ({
  activeTaskId: null,
  open: (taskId) => set({ activeTaskId: taskId }),
  close: () => set({ activeTaskId: null }),
}));
