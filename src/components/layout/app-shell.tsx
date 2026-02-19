'use client';

import { useEffect } from 'react';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Sidebar } from './sidebar';
import { CommandPalette } from '@/components/shared/command-palette';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ShortcutsHelp } from '@/components/shared/shortcuts-help';

interface AppShellProps {
  children: React.ReactNode;
  projects?: { id: string; name: string; color: string }[];
  workspaceName?: string;
  currentWorkspaceSlug?: string;
  workspaceId?: string;
}

export function AppShell({ children, projects, workspaceName, currentWorkspaceSlug, workspaceId }: AppShellProps) {
  const isOpen = useSidebarStore((s) => s.isOpen);
  const close = useSidebarStore((s) => s.close);

  useKeyboardShortcuts({
    workspaceSlug: currentWorkspaceSlug ?? '',
  });

  // モバイルではデフォルトで閉じる
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    if (mq.matches) close();
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) close();
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [close]);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'
        )}
      >
        <Sidebar
          projects={projects}
          workspaceName={workspaceName}
          currentWorkspaceSlug={currentWorkspaceSlug}
          workspaceId={workspaceId}
        />
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>

      <CommandPalette
        workspaceSlug={currentWorkspaceSlug ?? ''}
        projects={projects ?? []}
      />
      <ShortcutsHelp />
    </div>
  );
}
