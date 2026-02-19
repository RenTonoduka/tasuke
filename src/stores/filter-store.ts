import { create } from 'zustand';

export interface FilterState {
  priority: string[];
  assignee: string[];
  label: string[];
  dueDateFilter: 'all' | 'overdue' | 'today' | 'this-week' | 'no-date';
  sortBy: 'position' | 'created' | 'due' | 'priority' | 'title';
  sortOrder: 'asc' | 'desc';
}

interface FilterStore extends FilterState {
  setPriority: (v: string[]) => void;
  setAssignee: (v: string[]) => void;
  setLabel: (v: string[]) => void;
  setDueDateFilter: (v: FilterState['dueDateFilter']) => void;
  setSortBy: (v: FilterState['sortBy']) => void;
  setSortOrder: (v: FilterState['sortOrder']) => void;
  reset: () => void;
  hasActiveFilters: () => boolean;
}

const initialState: FilterState = {
  priority: [],
  assignee: [],
  label: [],
  dueDateFilter: 'all',
  sortBy: 'position',
  sortOrder: 'asc',
};

export const useFilterStore = create<FilterStore>((set, get) => ({
  ...initialState,
  setPriority: (v) => set({ priority: v }),
  setAssignee: (v) => set({ assignee: v }),
  setLabel: (v) => set({ label: v }),
  setDueDateFilter: (v) => set({ dueDateFilter: v }),
  setSortBy: (v) => set({ sortBy: v }),
  setSortOrder: (v) => set({ sortOrder: v }),
  reset: () => set(initialState),
  hasActiveFilters: () => {
    const s = get();
    return (
      s.priority.length > 0 ||
      s.assignee.length > 0 ||
      s.label.length > 0 ||
      s.dueDateFilter !== 'all' ||
      s.sortBy !== 'position'
    );
  },
}));
