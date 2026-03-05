'use client';

import { useState, useCallback } from 'react';

type PinState = 'pinned' | 'hidden';
type PinMap = Record<string, PinState>;

function getStorageKey(projectId: string) {
  return `gantt-pins:${projectId}`;
}

function loadPins(projectId: string): PinMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePins(projectId: string, pins: PinMap) {
  try {
    const cleaned = Object.fromEntries(Object.entries(pins).filter(([, v]) => v));
    if (Object.keys(cleaned).length === 0) {
      localStorage.removeItem(getStorageKey(projectId));
    } else {
      localStorage.setItem(getStorageKey(projectId), JSON.stringify(cleaned));
    }
  } catch {}
}

export function useGanttPins(projectId: string) {
  const [pins, setPins] = useState<PinMap>(() => loadPins(projectId));

  const togglePin = useCallback((taskId: string) => {
    setPins((prev) => {
      const current = prev[taskId];
      let next: PinMap;
      if (!current) {
        next = { ...prev, [taskId]: 'pinned' };
      } else if (current === 'pinned') {
        next = { ...prev, [taskId]: 'hidden' };
      } else {
        const { [taskId]: _, ...rest } = prev;
        next = rest;
      }
      savePins(projectId, next);
      return next;
    });
  }, [projectId]);

  const getState = useCallback((taskId: string): PinState | undefined => {
    return pins[taskId];
  }, [pins]);

  const getPinnedIds = useCallback((): Set<string> => {
    return new Set(Object.entries(pins).filter(([, v]) => v === 'pinned').map(([k]) => k));
  }, [pins]);

  const getHiddenIds = useCallback((): Set<string> => {
    return new Set(Object.entries(pins).filter(([, v]) => v === 'hidden').map(([k]) => k));
  }, [pins]);

  return { pins, togglePin, getState, getPinnedIds, getHiddenIds };
}
