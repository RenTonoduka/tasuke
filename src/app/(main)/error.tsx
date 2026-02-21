'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <AlertCircle className="h-12 w-12 text-[#EA4335]" />
      <h2 className="text-lg font-semibold text-g-text">エラーが発生しました</h2>
      <p className="max-w-md text-center text-sm text-g-text-muted">
        {error.message || 'ページの読み込み中にエラーが発生しました。もう一度お試しください。'}
      </p>
      <Button onClick={reset} className="bg-[#4285F4] hover:bg-[#3367D6]">
        もう一度試す
      </Button>
    </div>
  );
}
