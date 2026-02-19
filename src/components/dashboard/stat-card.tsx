import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-[#E8EAED]">
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', iconBg)}>
        <Icon className={cn('h-6 w-6', iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-[#5F6368]">{title}</p>
        <p className="mt-0.5 text-2xl font-bold text-[#202124]">{value.toLocaleString()}</p>
        {subtitle && <p className="mt-0.5 text-xs text-[#80868B]">{subtitle}</p>}
      </div>
    </div>
  );
}
