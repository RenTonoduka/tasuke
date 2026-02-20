'use client';

import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SHORTCUT_GROUPS = [
  {
    label: '一般',
    items: [
      { keys: ['⌘', 'K'], description: 'コマンドパレット' },
      { keys: ['?'], description: 'ショートカット一覧' },
      { keys: ['b'], description: 'サイドバー切替' },
      { keys: ['n'], description: '新規タスク' },
    ],
  },
  {
    label: '移動',
    items: [
      { keys: ['g', 'm'], description: 'マイタスク' },
      { keys: ['g', 'i'], description: 'インボックス' },
      { keys: ['g', 'd'], description: 'ダッシュボード' },
      { keys: ['g', 's'], description: '設定' },
    ],
  },
  {
    label: 'タスク',
    items: [
      { keys: ['Enter'], description: 'タスク詳細を開く' },
      { keys: ['Esc'], description: 'パネルを閉じる' },
    ],
  },
];

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-g-surface-hover px-1.5 font-mono text-[10px] font-medium text-g-text-secondary">
      {children}
    </kbd>
  );
}

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useHotkeys('shift+/', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    setOpen((prev) => !prev);
  }, { enableOnFormTags: false });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="border-b border-g-border px-5 py-4">
          <DialogTitle className="text-sm font-semibold text-g-text">
            キーボードショートカット
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-g-border">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label} className="px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-g-text-muted">
                {group.label}
              </p>
              <ul className="space-y-2.5">
                {group.items.map((item) => (
                  <li key={item.description} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-g-text-secondary">{item.description}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-[10px] text-g-text-muted">→</span>
                          )}
                          <KeyBadge>{key}</KeyBadge>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
