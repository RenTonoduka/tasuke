'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, LayoutGrid, List, GanttChart, CalendarClock, BarChart3, Network, Search, Settings, Zap, Pencil, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { ProjectSettingsDialog } from '@/components/project/project-settings-dialog';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
  view?: 'board' | 'list' | 'timeline' | 'schedule' | 'dashboard' | 'mindmap';
  onViewChange?: (view: 'board' | 'list' | 'timeline' | 'schedule' | 'dashboard' | 'mindmap') => void;
  workspaceSlug?: string;
  workspaceId?: string;
  projectId?: string;
  projectName?: string;
}

export function Header({ title = '', view = 'board', onViewChange, workspaceSlug = '', workspaceId = '', projectId, projectName = '' }: HeaderProps) {

  const toggle = useSidebarStore((s) => s.toggle);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditName(title); }, [title]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const saveProjectName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === title || !projectId) {
      setEditName(title);
      setEditing(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('プロジェクト名更新エラー:', err);
    }
    setEditing(false);
  };

  return (
    <header className="flex h-12 min-w-0 items-center gap-3 overflow-hidden border-b border-g-border bg-g-bg px-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-g-text-secondary lg:hidden"
        onClick={toggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {editing && projectId ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={saveProjectName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveProjectName();
            if (e.key === 'Escape') { setEditName(title); setEditing(false); }
          }}
          className="h-8 rounded-md border border-[#4285F4] bg-g-bg px-2 text-base font-semibold text-g-text outline-none"
          maxLength={100}
        />
      ) : (
        <button
          className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 text-base font-semibold text-g-text hover:bg-g-surface-hover"
          onClick={() => projectId && setEditing(true)}
          title={projectId ? 'クリックして名前を変更' : undefined}
        >
          {title}
          {projectId && <Pencil className="h-3 w-3 text-g-text-muted opacity-0 group-hover:opacity-100" />}
        </button>
      )}

      {onViewChange && (
        <div className="ml-4 flex flex-shrink-0 overflow-x-auto rounded-md border border-g-border scrollbar-hide">
          <button
            onClick={() => onViewChange('board')}
            className={cn(
              'flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-medium',
              view === 'board'
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ボード</span>
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={cn(
              'flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-medium',
              view === 'list'
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
            )}
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">リスト</span>
          </button>
          <button
            onClick={() => onViewChange('timeline')}
            className={cn(
              'flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-medium',
              view === 'timeline'
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
            )}
          >
            <GanttChart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">タイムライン</span>
          </button>
          <button
            onClick={() => onViewChange('schedule')}
            className={cn(
              'flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-medium',
              view === 'schedule'
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
            )}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">スケジュール</span>
          </button>
          <button
            onClick={() => onViewChange('dashboard')}
            className={cn(
              'flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-medium',
              view === 'dashboard'
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ダッシュボード</span>
          </button>
          <button
            onClick={() => onViewChange('mindmap')}
            className={cn(
              'flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-medium',
              view === 'mindmap'
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
            )}
          >
            <Network className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">マップ</span>
          </button>
        </div>
      )}

      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        <span className="hidden xl:inline-flex">
          {projectId && <ExportSheetButton projectId={projectId} />}
        </span>
        <span className="hidden xl:inline-flex">
          {projectId && (
            <SaveTemplateButton projectId={projectId} projectName={projectName || title} />
          )}
        </span>
        {projectId && workspaceSlug && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-g-text-secondary">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                名前を変更
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/${workspaceSlug}/projects/${projectId}/automations`}
                  className="flex items-center gap-2"
                >
                  <Zap className="h-4 w-4 text-[#4285F4]" />
                  自動化ルール
                </Link>
              </DropdownMenuItem>
              {workspaceId && (
                <ProjectSettingsDialog projectId={projectId!} workspaceId={workspaceId}>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Users className="mr-2 h-4 w-4" />
                    共有・メンバー管理
                  </DropdownMenuItem>
                </ProjectSettingsDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button className="flex flex-shrink-0 items-center gap-2 rounded-md border border-g-border px-3 py-1 text-xs text-g-text-muted hover:bg-g-surface-hover">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">検索...</span>
          <kbd className="ml-1 hidden rounded bg-g-surface-hover px-1.5 py-0.5 font-mono text-[10px] font-medium text-g-text-secondary md:inline">
            ⌘K
          </kbd>
        </button>
        {workspaceSlug && <NotificationBell workspaceSlug={workspaceSlug} />}
      </div>
    </header>
  );
}
