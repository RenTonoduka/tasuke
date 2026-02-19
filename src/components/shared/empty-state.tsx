'use client';

import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-[#DADCE0]">
        {icon ?? <Inbox className="h-12 w-12" />}
      </div>
      <h3 className="text-base font-medium text-[#5F6368]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[#80868B]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
