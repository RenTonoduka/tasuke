'use client';

import { useState } from 'react';
import { Paperclip, File, Trash2, ExternalLink, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { DriveFilePicker } from './drive-file-picker';

interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  driveFileId: string;
  iconUrl: string | null;
  size: number | null;
  createdAt: string;
}

interface AttachmentListProps {
  taskId: string;
  attachments: Attachment[];
  onChanged: () => void;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({ taskId, attachments, onChanged }: AttachmentListProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (file: { id: string }) => {
    setPickerOpen(false);
    setAttaching(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFileId: file.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'ファイルの添付に失敗しました');
        return;
      }
      onChanged();
    } catch {
      setError('ファイルの添付に失敗しました');
    } finally {
      setAttaching(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments/${deleteTargetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? '削除に失敗しました');
        return;
      }
      onChanged();
    } catch {
      setError('削除に失敗しました');
    } finally {
      setDeleting(false);
      setDeleteTargetId(null);
    }
  };

  return (
    <div className="border-t border-[#E8EAED] px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#5F6368]">
          <Paperclip className="h-3.5 w-3.5" />
          添付ファイル
          {attachments.length > 0 && (
            <span className="text-[#80868B]">({attachments.length})</span>
          )}
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-[#4285F4] hover:text-[#4285F4]"
          onClick={() => setPickerOpen(true)}
          disabled={attaching}
        >
          <Plus className="h-3.5 w-3.5" />
          {attaching ? '追加中...' : 'ドライブから追加'}
        </Button>
      </div>

      {error && (
        <div className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      {attachments.length === 0 ? (
        <p className="text-xs text-[#80868B]">添付ファイルはありません</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[#F8F9FA]"
            >
              {att.iconUrl ? (
                <img src={att.iconUrl} alt="" className="h-4 w-4 shrink-0" />
              ) : (
                <File className="h-4 w-4 shrink-0 text-[#80868B]" />
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-[#1a73e8] hover:underline"
                >
                  <span className="truncate">{att.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                {att.size !== null && (
                  <span className="text-xs text-[#80868B]">{formatFileSize(att.size)}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-[#80868B] hover:text-red-500"
                onClick={() => setDeleteTargetId(att.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <DriveFilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleSelect}
      />

      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>添付ファイルを削除</AlertDialogTitle>
            <AlertDialogDescription>
              この添付ファイルをタスクから削除しますか？Googleドライブのファイル本体は削除されません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? '削除中...' : '削除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
