'use client';

import { useState } from 'react';
import { Bell, MessageSquare, AtSign, UserCheck, GitBranch, CheckCheck, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  taskId: string | null;
}

interface InboxClientProps {
  initialNotifications: Notification[];
}

const typeIcon: Record<string, React.ReactNode> = {
  COMMENT: <MessageSquare className="h-4 w-4 text-[#4285F4]" />,
  MENTION: <AtSign className="h-4 w-4 text-[#FBBC04]" />,
  ASSIGNED: <UserCheck className="h-4 w-4 text-[#34A853]" />,
  STATUS_CHANGED: <GitBranch className="h-4 w-4 text-[#EA4335]" />,
};

const typeLabel: Record<string, string> = {
  COMMENT: 'コメント',
  MENTION: 'メンション',
  ASSIGNED: 'アサイン',
  STATUS_CHANGED: 'ステータス変更',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Filter = 'all' | 'unread' | 'read';

export function InboxClient({ initialNotifications }: InboxClientProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<Filter>('all');
  const { open: openPanel } = useTaskPanelStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
    }
    if (n.taskId) {
      openPanel(n.taskId);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ツールバー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-[#E8EAED] p-0.5">
          {(['all', 'unread', 'read'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-[#4285F4] text-white'
                  : 'text-[#5F6368] hover:bg-[#F1F3F4]'
              )}
            >
              {f === 'all' && `すべて (${notifications.length})`}
              {f === 'unread' && `未読 (${unreadCount})`}
              {f === 'read' && `既読 (${notifications.length - unreadCount})`}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={markAllRead}
            className="h-8 gap-1.5 text-xs border-[#E8EAED] text-[#5F6368] hover:text-[#202124]"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            すべて既読にする
          </Button>
        )}
      </div>

      {/* 通知リスト */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-[#E8EAED] py-20">
          <Bell className="mb-3 h-8 w-8 text-[#80868B]" />
          <p className="text-sm text-[#5F6368]">通知はありません</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E8EAED] rounded-lg border border-[#E8EAED] overflow-hidden">
          {filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                'flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-[#F8F9FA]',
                !n.read && 'bg-[#EEF3FE] hover:bg-[#E8F0FD]'
              )}
            >
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-[#E8EAED]">
                {typeIcon[n.type] ?? <Bell className="h-4 w-4 text-[#80868B]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="rounded-full bg-[#F1F3F4] px-2 py-0.5 text-[11px] font-medium text-[#5F6368]">
                    {typeLabel[n.type] ?? n.type}
                  </span>
                  {!n.read && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4285F4]" />
                  )}
                </div>
                <p className="text-sm text-[#202124]">{n.message}</p>
                <p className="mt-1 text-xs text-[#80868B]">{formatDate(n.createdAt)}</p>
              </div>
              {n.taskId && (
                <span className="flex-shrink-0 text-xs text-[#4285F4]">
                  タスクを開く
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
