'use client';

import { StatusChart } from '@/components/dashboard/status-chart';
import { PriorityChart } from '@/components/dashboard/priority-chart';
import { ActivityTrend } from '@/components/dashboard/activity-trend';
import { ProjectGantt } from '@/components/dashboard/project-gantt';

interface GanttTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
}

interface GanttProject {
  id: string;
  name: string;
  color: string;
  tasks: GanttTask[];
}

interface DashboardClientProps {
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  recentActivity: { date: string; count: number }[];
  completionRate: number;
  ganttProjects: GanttProject[];
}

export function DashboardClient({
  byStatus,
  byPriority,
  recentActivity,
  completionRate,
  ganttProjects,
}: DashboardClientProps) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <StatusChart data={byStatus} completionRate={completionRate} />
        <PriorityChart data={byPriority} />
      </div>
      <ActivityTrend data={recentActivity} />
      <ProjectGantt projects={ganttProjects} />
    </>
  );
}
