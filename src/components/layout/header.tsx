'use client';

import { Menu, LayoutGrid, List, GanttChart, CalendarClock, Search, Settings, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebarStore } from '@/stores/sidebar-store';
import { NotificationBell } from './notification-bell';
import { ExportSheetButton } from '@/components/project/export-sheet-button';
import { SaveTemplateButton } from '@/components/project/save-template-button';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
  view?: 'board' | 'list' | 'timeline' | 'schedule';
  onViewChange?: (view: 'board' | 'list' | 'timeline' | 'schedule') => void;
  workspaceSlug?: string;
  projectId?: string;
  projectName?: string;
}

export function Header({ title = '', view = 'board', onViewChange, workspaceSlug = '', projectId, projectName = '' }: HeaderProps) {

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
          <button
            onClick={() => onViewChange('timeline')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium',
              view === 'timeline'
                ? 'bg-[#E8EAED] text-[#202124]'
                : 'text-[#5F6368] hover:bg-[#F1F3F4]'
            )}
          >
            <GanttChart className="h-3.5 w-3.5" />
            タイムライン
          </button>
          <button
            onClick={() => onViewChange('schedule')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium',
              view === 'schedule'
                ? 'bg-[#E8EAED] text-[#202124]'
                : 'text-[#5F6368] hover:bg-[#F1F3F4]'
            )}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            スケジュール
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {projectId && <ExportSheetButton projectId={projectId} />}
        {projectId && (
          <SaveTemplateButton projectId={projectId} projectName={projectName || title} />
        )}
        {projectId && workspaceSlug && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5F6368]">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  href={`/${workspaceSlug}/projects/${projectId}/automations`}
                  className="flex items-center gap-2"
                >
                  <Zap className="h-4 w-4 text-[#4285F4]" />
                  自動化ルール
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
