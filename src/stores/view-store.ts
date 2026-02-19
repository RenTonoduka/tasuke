import { create } from 'zustand';

interface ViewStore {
  view: 'board' | 'list';
  setView: (view: 'board' | 'list') => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  view: 'board',
  setView: (view) => set({ view }),
}));
