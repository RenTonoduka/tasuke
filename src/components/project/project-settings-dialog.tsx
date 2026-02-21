'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Globe, UserPlus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Member {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface ProjectSettingsDialogProps {
  projectId: string;
  workspaceId: string;
  children: React.ReactNode;
}

export function ProjectSettingsDialog({ projectId, workspaceId, children }: ProjectSettingsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [wsMembers, setWsMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [projRes, membersRes, wsMembersRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch(`/api/projects/${projectId}/members`),
      fetch(`/api/workspaces/${workspaceId}/members`),
    ]);
    if (projRes.ok) {
      const { data } = await projRes.json();
      setIsPrivate(data.isPrivate ?? false);
    }
    if (membersRes.ok) {
      const { data } = await membersRes.json();
      setMembers(data);
    }
    if (wsMembersRes.ok) {
      const { data } = await wsMembersRes.json();
      setWsMembers(data);
    }
  }, [projectId, workspaceId]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const togglePrivate = async (value: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrivate: value }),
      });
      if (res.ok) {
        setIsPrivate(value);
        await fetchData();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (userId: string) => {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setMembers((prev) => [...prev, data]);
    }
  };

  const removeMember = async (userId: string) => {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    }
  };

  const memberUserIds = new Set(members.map((m) => m.userId));
  const nonMembers = wsMembers.filter((m) => !memberUserIds.has(m.userId));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>プロジェクト設定</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 公開/非公開トグル */}
          <div className="flex items-center justify-between rounded-lg border border-g-border p-4">
            <div className="flex items-center gap-3">
              {isPrivate ? (
                <Lock className="h-5 w-5 text-amber-500" />
              ) : (
                <Globe className="h-5 w-5 text-green-500" />
              )}
              <div>
                <p className="text-sm font-medium text-g-text">
                  {isPrivate ? '非公開プロジェクト' : '公開プロジェクト'}
                </p>
                <p className="text-xs text-g-text-muted">
                  {isPrivate
                    ? '選択されたメンバーのみアクセス可能'
                    : 'ワークスペース全メンバーがアクセス可能'}
                </p>
              </div>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={togglePrivate}
              disabled={loading}
            />
          </div>

          {/* メンバー管理（非公開時のみ） */}
          {isPrivate && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-g-text">プロジェクトメンバー</h3>

              {/* 現在のメンバー */}
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-g-surface-hover">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.user.image ?? ''} />
                      <AvatarFallback className="bg-[#4285F4] text-[10px] text-white">
                        {m.user.name?.charAt(0) ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm text-g-text">
                      {m.user.name ?? m.user.email}
                    </span>
                    <button
                      onClick={() => removeMember(m.userId)}
                      className="rounded p-0.5 text-g-text-muted hover:bg-g-border hover:text-g-text"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* メンバー追加 */}
              {nonMembers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-g-text-muted">メンバーを追加</p>
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {nonMembers.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => addMember(m.userId)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-g-surface-hover"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={m.user.image ?? ''} />
                          <AvatarFallback className="bg-gray-400 text-[10px] text-white">
                            {m.user.name?.charAt(0) ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-sm text-g-text-secondary">
                          {m.user.name ?? m.user.email}
                        </span>
                        <UserPlus className="h-3.5 w-3.5 text-g-text-muted" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
