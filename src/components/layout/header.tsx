'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, LayoutGrid, List, GanttChart, CalendarClock, BarChart3, Network, Search, Settings, Zap, Pencil, Users, Trash2, FileSpreadsheet, Copy } from 'lucide-react';
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
import { ProjectSettingsDialog } from '@/components/project/project-settings-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
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
  const [exporting, setExporting] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);

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

  const handleExportSheet = async () => {
    if (!projectId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export-sheet`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'エクスポートに失敗しました');
      }
      const { spreadsheetUrl } = await res.json();
      window.open(spreadsheetUrl, '_blank');
      toast({ title: 'エクスポート完了', description: 'スプレッドシートを新しいタブで開きました' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'エクスポート失敗', description: err instanceof Error ? err.message : 'エクスポートに失敗しました' });
    } finally {
      setExporting(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !projectId) return;
    setTemplateSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/save-as-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName.trim(), description: templateDesc.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '保存に失敗しました');
      }
      setTemplateOpen(false);
      toast({ title: 'テンプレートとして保存しました', description: `「${templateName}」をテンプレートに保存しました` });
    } catch (err) {
      toast({ variant: 'destructive', title: '保存エラー', description: err instanceof Error ? err.message : '保存に失敗しました' });
    } finally {
      setTemplateSaving(false);
    }
  };

  const deleteProject = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast({ title: 'プロジェクトの削除に失敗しました', variant: 'destructive' });
        return;
      }
      toast({ title: 'プロジェクトを削除しました' });
      router.push(`/${workspaceSlug}`);
    } catch {
      toast({ title: 'プロジェクトの削除に失敗しました', variant: 'destructive' });
    }
  };

  return (
  <>
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
          className="h-8 min-w-[120px] rounded-md border border-[#4285F4] bg-g-bg px-2 text-base font-semibold text-g-text outline-none"
          maxLength={100}
        />
      ) : (
        <button
          className="group flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-base font-semibold text-g-text hover:bg-g-surface-hover"
          onClick={() => projectId && setEditing(true)}
          title={projectId ? 'クリックして名前を変更' : undefined}
        >
          <span className="truncate">{title}</span>
          {projectId && <Pencil className="h-3 w-3 flex-shrink-0 text-g-text-muted opacity-0 group-hover:opacity-100" />}
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
            <span className="hidden md:inline">ボード</span>
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
            <span className="hidden md:inline">リスト</span>
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
            <span className="hidden md:inline">タイムライン</span>
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
            <span className="hidden md:inline">スケジュール</span>
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
            <span className="hidden md:inline">ダッシュボード</span>
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
            <span className="hidden md:inline">マップ</span>
          </button>
        </div>
      )}

      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        {projectId && workspaceId && (
          <ProjectSettingsDialog projectId={projectId} workspaceId={workspaceId}>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">共有</span>
            </Button>
          </ProjectSettingsDialog>
        )}
        {projectId && workspaceSlug && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-g-text-secondary">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportSheet} disabled={exporting}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {exporting ? 'エクスポート中...' : 'スプレッドシートにエクスポート'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTemplateName(projectName || title); setTemplateDesc(''); setTemplateOpen(true); }}>
                <Copy className="mr-2 h-4 w-4" />
                テンプレートとして保存
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500 focus:text-red-500">
                    <Trash2 className="mr-2 h-4 w-4" />
                    プロジェクトを削除
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>プロジェクトを削除しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      「{title}」とそのタスクをすべて削除します。この操作は取り消せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteProject} className="bg-red-500 hover:bg-red-600">
                      削除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

    <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>テンプレートとして保存</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="template-name" className="text-sm">テンプレート名</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="テンプレート名"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-desc" className="text-sm">説明（任意）</Label>
            <Input
              id="template-desc"
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              placeholder="テンプレートの説明"
            />
          </div>
          <Button
            onClick={handleSaveTemplate}
            disabled={!templateName.trim() || templateSaving}
            className="w-full bg-[#4285F4] hover:bg-[#3367D6]"
          >
            {templateSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}
