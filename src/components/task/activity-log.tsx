'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle,
  RotateCcw,
  ArrowRight,
  MessageSquare,
  Flag,
  Calendar,
  Edit,
} from 'lucide-react';

interface Activity {
  id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface ActivityLogProps {
  taskId: string;
}

const typeConfig: Record<
  string,
  { icon: React.ElementType; color: string; label: (meta: Record<string, unknown> | null) => string }
> = {
  TASK_CREATED: {
    icon: Plus,
    color: '#34A853',
    label: () => 'タスクを作成しました',
  },
  TASK_COMPLETED: {
    icon: CheckCircle,
    color: '#34A853',
    label: () => 'タスクを完了しました',
  },
  TASK_REOPENED: {
    icon: RotateCcw,
    color: '#FBBC04',
    label: () => 'タスクを再開しました',
  },
  TASK_MOVED: {
    icon: ArrowRight,
    color: '#4285F4',
    label: () => 'タスクを移動しました',
  },
  COMMENT_ADDED: {
    icon: MessageSquare,
    color: '#4285F4',
    label: () => 'コメントを追加しました',
  },
  PRIORITY_CHANGED: {
    icon: Flag,
    color: '#EA4335',
    label: (meta) => {
      if (meta?.from && meta?.to) return `優先度を${meta.from}から${meta.to}に変更しました`;
      if (meta?.to) return `優先度を${meta.to}に変更しました`;
      return '優先度を変更しました';
    },
  },
  DUE_DATE_CHANGED: {
    icon: Calendar,
    color: '#FBBC04',
    label: () => '期限を変更しました',
  },
  TASK_UPDATED: {
    icon: Edit,
    color: '#80868B',
    label: () => 'タスクを更新しました',
  },
};

function getConfig(type: string) {
  return typeConfig[type] ?? {
    icon: Edit,
    color: '#80868B',
    label: () => 'タスクを更新しました',
  };
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

export function ActivityLog({ taskId }: ActivityLogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    fetch(`/api/tasks/${taskId}/activities`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setActivities(data);
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="space-y-3 px-4 py-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-[#E8EAED] animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-32 rounded bg-[#E8EAED] animate-pulse" />
              <div className="h-3 w-20 rounded bg-[#E8EAED] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="px-4 py-4 text-xs text-[#80868B]">アクティビティはまだありません</p>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="relative">
        {/* タイムラインの縦線 */}
        <div
          className="absolute left-[9px] top-1 bottom-0 w-px bg-[#E8EAED]"
          style={{ height: `calc(100% - 8px)` }}
        />

        <div className="space-y-4">
          {activities.map((activity) => {
            const config = getConfig(activity.type);
            const Icon = config.icon;
            const label = config.label(activity.metadata);

            return (
              <div key={activity.id} className="relative flex gap-3">
                {/* ドット */}
                <div
                  className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white"
                  style={{ boxShadow: `0 0 0 2px ${config.color}` }}
                >
                  <Icon
                    className="h-3 w-3"
                    style={{ color: config.color }}
                    strokeWidth={2.5}
                  />
                </div>

                {/* コンテンツ */}
                <div className="min-w-0 flex-1 pb-1">
                  <p className="text-xs text-[#202124]">
                    <span className="font-medium">
                      {activity.user.name ?? 'ユーザー'}
                    </span>
                    <span className="text-[#5F6368]">が{label}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#80868B]">
                    {formatRelativeTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
