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
import { useGoogleSync } from '@/hooks/use-google-sync';

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { syncing, unlinking, errorMessage, sync, unlink } = useGoogleSync(
    taskId,
    'sync-gtasks',
    onSync
  );

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
      <div className="space-y-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={sync}
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
        {errorMessage && (
          <p className="text-xs text-[#EA4335]">{errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
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
                onClick={sync}
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
                onClick={() => setConfirmOpen(true)}
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

      {errorMessage && (
        <p className="text-xs text-[#EA4335]">{errorMessage}</p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>連携を解除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              Googleタスクとの連携を解除します。Googleタスク側のタスクも削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#EA4335] hover:bg-[#c5221f]"
              onClick={() => {
                setConfirmOpen(false);
                unlink();
              }}
            >
              解除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
