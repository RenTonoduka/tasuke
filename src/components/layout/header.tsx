'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, LayoutGrid, List, GanttChart, CalendarClock, Search, Settings, Zap, Pencil } from 'lucide-react';
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
    <header className="flex h-12 items-center gap-3 border-b border-g-border bg-g-bg px-4">
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
        <div className="ml-4 flex rounded-md border border-g-border">
          <button
            onClick={() => onViewChange('board')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium',
              view === 'board'
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
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
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
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
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
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
                ? 'bg-g-border text-g-text'
                : 'text-g-text-secondary hover:bg-g-surface-hover'
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
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button className="flex items-center gap-2 rounded-md border border-g-border px-3 py-1 text-xs text-g-text-muted hover:bg-g-surface-hover">
          <Search className="h-3.5 w-3.5" />
          <span>検索...</span>
          <kbd className="ml-1 rounded bg-g-surface-hover px-1.5 py-0.5 font-mono text-[10px] font-medium text-g-text-secondary">
            ⌘K
          </kbd>
        </button>
        {workspaceSlug && <NotificationBell workspaceSlug={workspaceSlug} />}
      </div>
    </header>
  );
}
