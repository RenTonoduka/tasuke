'use client';

import { useEffect, useRef } from 'react';
import { useFilterStore } from '@/stores/filter-store';
import type { FilterState } from '@/stores/filter-store';

export function useFilterUrlSync() {
  const initialized = useRef(false);

  // Read URL → store on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const priority = params.get('priority')?.split(',').filter(Boolean) ?? [];
    const status = params.get('status')?.split(',').filter(Boolean) ?? [];
    const assignee = params.get('assignee')?.split(',').filter(Boolean) ?? [];
    const label = params.get('label')?.split(',').filter(Boolean) ?? [];
    const dueDateFilter = (params.get('due') ?? 'all') as FilterState['dueDateFilter'];
    const sortBy = (params.get('sort') ?? 'position') as FilterState['sortBy'];
    const sortOrder = (params.get('order') ?? 'asc') as FilterState['sortOrder'];

    const store = useFilterStore.getState();
    if (priority.length) store.setPriority(priority);
    if (status.length) store.setStatus(status);
    if (assignee.length) store.setAssignee(assignee);
    if (label.length) store.setLabel(label);
    if (dueDateFilter !== 'all') store.setDueDateFilter(dueDateFilter);
    if (sortBy !== 'position') store.setSortBy(sortBy);
    if (sortOrder !== 'asc') store.setSortOrder(sortOrder);
  }, []);

  // Store → URL on changes
  useEffect(() => {
    return useFilterStore.subscribe((state) => {
      const params = new URLSearchParams();
      if (state.priority.length) params.set('priority', state.priority.join(','));
      if (state.status.length) params.set('status', state.status.join(','));
      if (state.assignee.length) params.set('assignee', state.assignee.join(','));
      if (state.label.length) params.set('label', state.label.join(','));
      if (state.dueDateFilter !== 'all') params.set('due', state.dueDateFilter);
      if (state.sortBy !== 'position') params.set('sort', state.sortBy);
      if (state.sortOrder !== 'asc') params.set('order', state.sortOrder);

      const qs = params.toString();
      const base = window.location.pathname;
      const newUrl = qs ? `${base}?${qs}` : base;
      window.history.replaceState(null, '', newUrl);
    });
  }, []);

  // Reset filters on unmount (navigating away)
  useEffect(() => {
    return () => {
      useFilterStore.getState().reset();
    };
  }, []);
}
