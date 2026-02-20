'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bell, MessageSquare, AtSign, UserCheck, GitBranch, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { cn } from '@/lib/utils';
import { AppNotification } from '@/types';

interface NotificationBellProps {
  workspaceSlug: string;
}

const typeIcon: Record<string, React.ReactNode> = {
  COMMENT: <MessageSquare className="h-3.5 w-3.5 text-[#4285F4]" />,
  MENTION: <AtSign className="h-3.5 w-3.5 text-[#FBBC04]" />,
  ASSIGNED: <UserCheck className="h-3.5 w-3.5 text-[#34A853]" />,
  STATUS_CHANGED: <GitBranch className="h-3.5 w-3.5 text-[#EA4335]" />,
};

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

export function NotificationBell({ workspaceSlug }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const { open: openPanel } = useTaskPanelStore();

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications');
    if (res.ok) {
      const data = await res.json();
      setNotifications(data);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const preview = notifications.slice(0, 10);

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = async (n: AppNotification) => {
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
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-g-text-secondary hover:text-g-text"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#EA4335] text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-g-border px-4 py-2.5">
          <span className="text-sm font-semibold text-g-text">通知</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-[#4285F4] hover:text-[#3367D6]"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              すべて既読
            </button>
          )}
        </div>

        {/* 通知リスト */}
        <ScrollArea className="max-h-[360px]">
          {preview.length === 0 ? (
            <div className="py-8 text-center text-sm text-g-text-muted">
              通知はありません
            </div>
          ) : (
            <div>
              {preview.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-g-surface',
                    !n.read && 'bg-[#EEF3FE]'
                  )}
                >
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-g-bg shadow-sm">
                    {typeIcon[n.type] ?? <Bell className="h-3.5 w-3.5 text-g-text-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-g-text leading-snug line-clamp-2">
                      {n.message}
                    </p>
                    <p className="mt-0.5 text-[11px] text-g-text-muted">
                      {formatRelative(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#4285F4]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* フッター */}
        <div className="border-t border-g-border px-4 py-2">
          <Link
            href={`/${workspaceSlug}/inbox`}
            onClick={() => setOpen(false)}
            className="block text-center text-xs text-[#4285F4] hover:text-[#3367D6]"
          >
            すべて見る
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
