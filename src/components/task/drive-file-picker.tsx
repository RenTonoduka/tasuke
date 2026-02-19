'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, File, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  iconLink: string | null;
  size: number | null;
  modifiedTime: string | null;
}

interface DriveFilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (file: DriveFile) => void;
}

function formatModifiedTime(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getMimeTypeLabel(mimeType: string): string {
  if (mimeType.includes('spreadsheet')) return 'スプレッドシート';
  if (mimeType.includes('document')) return 'ドキュメント';
  if (mimeType.includes('presentation')) return 'スライド';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('image')) return '画像';
  if (mimeType.includes('folder')) return 'フォルダ';
  if (mimeType.includes('video')) return '動画';
  if (mimeType.includes('audio')) return '音声';
  return 'ファイル';
}

export function DriveFilePicker({ open, onOpenChange, onSelect }: DriveFilePickerProps) {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drive/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'ファイルの取得に失敗しました');
        setFiles([]);
        return;
      }
      const data = await res.json();
      setFiles(data);
    } catch {
      setError('ファイルの取得に失敗しました');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, search]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setFiles([]);
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Googleドライブからファイルを添付</DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#80868B]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ファイル名で検索..."
            className="w-full rounded-md border border-[#E8EAED] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#4285F4]"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#80868B] hover:text-[#202124]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="py-8 text-center text-sm text-[#80868B]">検索中...</div>
          )}
          {!loading && error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          {!loading && !error && files.length === 0 && (
            <div className="py-8 text-center text-sm text-[#80868B]">
              {query ? 'ファイルが見つかりません' : 'ファイルを検索してください'}
            </div>
          )}
          {!loading && !error && files.length > 0 && (
            <ul className="divide-y divide-[#E8EAED]">
              {files.map((file) => (
                <li key={file.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-none px-2 py-2 h-auto text-left hover:bg-[#F8F9FA]"
                    onClick={() => onSelect(file)}
                  >
                    {file.iconLink ? (
                      <img src={file.iconLink} alt="" className="h-5 w-5 shrink-0" />
                    ) : (
                      <File className="h-5 w-5 shrink-0 text-[#80868B]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#202124]">
                        {file.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#80868B]">
                        <span>{getMimeTypeLabel(file.mimeType)}</span>
                        {file.modifiedTime && (
                          <span>· {formatModifiedTime(file.modifiedTime)}</span>
                        )}
                      </div>
                    </div>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
