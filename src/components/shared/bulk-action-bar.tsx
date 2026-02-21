'use client';

import { useState } from 'react';
import { X, Trash2, Flag, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSelectionStore } from '@/stores/selection-store';

const statusActions = [
  { value: 'TODO', label: '未着手' },
  { value: 'IN_PROGRESS', label: '進行中' },
  { value: 'DONE', label: '完了' },
  { value: 'ARCHIVED', label: 'アーカイブ' },
];

const priorityActions = [
  { value: 'P0', label: 'P0 - 緊急', color: '#EA4335' },
  { value: 'P1', label: 'P1 - 高', color: '#FBBC04' },
  { value: 'P2', label: 'P2 - 中', color: '#4285F4' },
  { value: 'P3', label: 'P3 - 低', color: '#80868B' },
];

interface BulkActionBarProps {
  onAction: () => void;
}

export function BulkActionBar({ onAction }: BulkActionBarProps) {
  const { selectedIds, clear } = useSelectionStore();
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const count = selectedIds.size;

  if (count === 0) return null;

  const execute = async (action: string, value?: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIds: Array.from(selectedIds),
          action,
          value,
        }),
      });
      if (res.ok) {
        clear();
        onAction();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-g-border bg-g-surface px-4 py-2 shadow-lg">
      <span className="text-sm font-medium text-g-text">
        {count}件選択中
      </span>

      {/* Status change */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={loading}>
            <CheckCircle className="h-3.5 w-3.5" />
            ステータス
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {statusActions.map((s) => (
            <DropdownMenuItem key={s.value} onClick={() => execute('status', s.value)}>
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority change */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={loading}>
            <Flag className="h-3.5 w-3.5" />
            優先度
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {priorityActions.map((p) => (
            <DropdownMenuItem key={p.value} onClick={() => execute('priority', p.value)}>
              <Flag className="mr-2 h-3 w-3" style={{ color: p.color }} />
              {p.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs text-[#EA4335] hover:bg-red-50 hover:text-[#EA4335]"
        disabled={loading}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        削除
      </Button>

      {/* Clear selection */}
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>
        <X className="h-3.5 w-3.5" />
      </Button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>タスクを削除</AlertDialogTitle>
            <AlertDialogDescription>
              選択した{count}件のタスクを削除しますか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#EA4335] hover:bg-red-600"
              onClick={() => execute('delete')}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
