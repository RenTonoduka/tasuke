'use client';

import { Menu, LayoutGrid, List, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/stores/sidebar-store';
import { NotificationBell } from './notification-bell';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
  view?: 'board' | 'list';
  onViewChange?: (view: 'board' | 'list') => void;
  workspaceSlug?: string;
}

export function Header({ title = '', view = 'board', onViewChange, workspaceSlug = '' }: HeaderProps) {
  const toggle = useSidebarStore((s) => s.toggle);

  return (
    <header className="flex h-12 items-center gap-3 border-b border-[#E8EAED] bg-white px-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-[#5F6368] lg:hidden"
        onClick={toggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="text-base font-semibold text-[#202124]">{title}</h1>

      {onViewChange && (
        <div className="ml-4 flex rounded-md border border-[#E8EAED]">
          <button
            onClick={() => onViewChange('board')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium',
              view === 'board'
                ? 'bg-[#E8EAED] text-[#202124]'
                : 'text-[#5F6368] hover:bg-[#F1F3F4]'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            ボード
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium',
              view === 'list'
                ? 'bg-[#E8EAED] text-[#202124]'
                : 'text-[#5F6368] hover:bg-[#F1F3F4]'
            )}
          >
            <List className="h-3.5 w-3.5" />
            リスト
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button className="flex items-center gap-2 rounded-md border border-[#E8EAED] px-3 py-1 text-xs text-[#80868B] hover:bg-[#F1F3F4]">
          <Search className="h-3.5 w-3.5" />
          <span>検索...</span>
          <kbd className="ml-1 rounded bg-[#F1F3F4] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#5F6368]">
            ⌘K
          </kbd>
        </button>
        {workspaceSlug && <NotificationBell workspaceSlug={workspaceSlug} />}
      </div>
    </header>
  );
}
