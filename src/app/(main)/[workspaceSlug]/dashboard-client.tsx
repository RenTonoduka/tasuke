'use client';

import { StatusChart } from '@/components/dashboard/status-chart';
import { PriorityChart } from '@/components/dashboard/priority-chart';
import { ActivityTrend } from '@/components/dashboard/activity-trend';

interface DashboardClientProps {
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  recentActivity: { date: string; count: number }[];
  completionRate: number;
}

export function DashboardClient({
  byStatus,
  byPriority,
  recentActivity,
  completionRate,
}: DashboardClientProps) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <StatusChart data={byStatus} completionRate={completionRate} />
        <PriorityChart data={byPriority} />
      </div>
      <ActivityTrend data={recentActivity} />
    </>
  );
}
