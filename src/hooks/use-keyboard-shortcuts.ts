'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import { useRouter } from 'next/navigation';
import { useSidebarStore } from '@/stores/sidebar-store';

interface UseKeyboardShortcutsProps {
  workspaceSlug: string;
  onNewTask?: () => void;
}

function isInputFocused(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement).tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useKeyboardShortcuts({ workspaceSlug, onNewTask }: UseKeyboardShortcutsProps) {
  const router = useRouter();
  const toggleSidebar = useSidebarStore((s) => s.toggle);

  // n: 新規タスク
  useHotkeys('n', (e) => {
    if (isInputFocused(e)) return;
    e.preventDefault();
    onNewTask?.();
  }, { enableOnFormTags: false });

  // g then m: マイタスクへ移動
  useHotkeys('g+m', () => {
    router.push(`/${workspaceSlug}/my-tasks`);
  }, { enableOnFormTags: false });

  // g then i: インボックスへ移動
  useHotkeys('g+i', () => {
    router.push(`/${workspaceSlug}/inbox`);
  }, { enableOnFormTags: false });

  // g then d: ダッシュボードへ移動
  useHotkeys('g+d', () => {
    router.push(`/${workspaceSlug}`);
  }, { enableOnFormTags: false });

  // g then s: 設定へ移動
  useHotkeys('g+s', () => {
    router.push(`/${workspaceSlug}/settings/members`);
  }, { enableOnFormTags: false });

  // b: サイドバートグル
  useHotkeys('b', (e) => {
    if (isInputFocused(e)) return;
    e.preventDefault();
    toggleSidebar();
  }, { enableOnFormTags: false });
}
