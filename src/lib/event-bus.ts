/**
 * 軽量イベントバス - コンポーネント間のデータ同期用
 * Zustandより軽量で、既存コードへの影響を最小限に抑える
 */

type Handler = (...args: unknown[]) => void;

const listeners = new Map<string, Set<Handler>>();

export const eventBus = {
  on(event: string, handler: Handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
    return () => { listeners.get(event)?.delete(handler); };
  },

  emit(event: string, ...args: unknown[]) {
    listeners.get(event)?.forEach((handler) => handler(...args));
  },
};

// イベント名の定数
export const EVENTS = {
  /** プロジェクト作成/削除/リネーム時 */
  PROJECTS_CHANGED: 'projects:changed',
  /** タスク更新時（詳細パネルから） */
  TASK_UPDATED: 'task:updated',
  /** タスク削除時 */
  TASK_DELETED: 'task:deleted',
} as const;
