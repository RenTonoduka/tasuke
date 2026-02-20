'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function BoardSkeleton() {
  return (
    <div className="flex gap-4 p-4">
      {[0, 1, 2].map((col) => (
        <div key={col} className="w-[280px] flex-shrink-0 rounded-lg bg-g-surface p-3">
          <Skeleton className="mb-4 h-5 w-24" />
          <div className="space-y-3">
            {[0, 1, 2].map((card) => (
              <div key={card} className="rounded-lg bg-g-bg p-3 shadow-sm">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
