'use client';

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ExportSheetButtonProps {
  projectId: string;
}

export function ExportSheetButton({ projectId }: ExportSheetButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export-sheet`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'エクスポートに失敗しました');
      }

      const { spreadsheetUrl } = await res.json();
      window.open(spreadsheetUrl, '_blank');

      toast({
        title: 'エクスポート完了',
        description: 'スプレッドシートを新しいタブで開きました',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'エクスポート失敗',
        description: err instanceof Error ? err.message : 'エクスポートに失敗しました',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs text-g-text-secondary hover:bg-g-surface-hover"
      onClick={handleExport}
      disabled={loading}
    >
      <FileSpreadsheet className="h-3.5 w-3.5" />
      {loading ? 'エクスポート中...' : 'スプレッドシートにエクスポート'}
    </Button>
  );
}
