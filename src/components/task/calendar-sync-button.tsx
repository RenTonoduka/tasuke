'use client';

import { useState } from 'react';
import { Calendar, RefreshCw, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CalendarSyncButtonProps {
  taskId: string;
  googleCalendarEventId: string | null;
  googleSyncedAt: string | null;
  dueDate: string | null;
  onSync: () => void;
}

function formatSyncedAt(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CalendarSyncButton({
  taskId,
  googleCalendarEventId,
  googleSyncedAt,
  dueDate,
  onSync,
}: CalendarSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSynced = !!googleCalendarEventId;

  const handleSync = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/sync-calendar`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? '同期に失敗しました');
        return;
      }
      onSync();
    } catch {
      setErrorMessage('ネットワークエラーが発生しました');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUnlink = async () => {
    setIsUnlinking(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/sync-calendar`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? '連携解除に失敗しました');
        return;
      }
      onSync();
    } catch {
      setErrorMessage('ネットワークエラーが発生しました');
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-1.5">
        {!dueDate ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="h-8 gap-1.5 text-xs text-[#80868B]"
              >
                <Calendar className="h-3.5 w-3.5" />
                Googleカレンダーに同期
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>期限を設定してからカレンダー同期できます</p>
            </TooltipContent>
          </Tooltip>
        ) : !isSynced ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-8 gap-1.5 text-xs"
          >
            {isSyncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Calendar className="h-3.5 w-3.5 text-[#4285F4]" />
            )}
            {isSyncing ? '同期中...' : 'Googleカレンダーに同期'}
          </Button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-[#34A853]">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                同期済み
                {googleSyncedAt && (
                  <span className="text-[#80868B]">
                    （最終: {formatSyncedAt(googleSyncedAt)}）
                  </span>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing || isUnlinking}
                className="h-7 gap-1.5 text-xs"
              >
                {isSyncing ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {isSyncing ? '更新中...' : '再同期'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnlink}
                disabled={isSyncing || isUnlinking}
                className="h-7 gap-1.5 text-xs text-[#EA4335] hover:text-[#EA4335]"
              >
                {isUnlinking ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Unlink className="h-3 w-3" />
                )}
                {isUnlinking ? '解除中...' : '連携解除'}
              </Button>
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="text-xs text-[#EA4335]">{errorMessage}</p>
        )}
      </div>
    </TooltipProvider>
  );
}
