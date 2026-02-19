'use client';

import { useState } from 'react';
import { ListTodo, RefreshCw, Unlink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GTasksSyncButtonProps {
  taskId: string;
  googleTaskId: string | null;
  googleSyncedAt: string | null;
  onSync: () => void;
}

export function GTasksSyncButton({
  taskId,
  googleTaskId,
  googleSyncedAt,
  onSync,
}: GTasksSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/sync-gtasks`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? '同期に失敗しました');
        return;
      }
      onSync();
    } catch {
      alert('同期中にエラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Googleタスクとの連携を解除しますか？\nGoogleタスク側のタスクも削除されます。')) return;
    setUnlinking(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/sync-gtasks`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? '連携解除に失敗しました');
        return;
      }
      onSync();
    } catch {
      alert('連携解除中にエラーが発生しました');
    } finally {
      setUnlinking(false);
    }
  };

  const formattedSyncedAt = googleSyncedAt
    ? new Date(googleSyncedAt).toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  if (!googleTaskId) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListTodo className="h-3.5 w-3.5" />
              )}
              Googleタスクに同期
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Googleタスクにエクスポートします</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1 rounded-md border border-[#E8EAED] bg-[#F8F9FA] px-2 py-1 text-xs text-[#34A853]">
              <ListTodo className="h-3.5 w-3.5" />
              同期済み
              {formattedSyncedAt && (
                <span className="ml-1 text-[#80868B]">{formattedSyncedAt}</span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Googleタスクと連携中</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleSync}
              disabled={syncing || unlinking}
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 text-[#5F6368]" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>再同期</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleUnlink}
              disabled={syncing || unlinking}
            >
              {unlinking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unlink className="h-3.5 w-3.5 text-[#EA4335]" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>連携解除</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
