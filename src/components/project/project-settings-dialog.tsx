'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Globe, UserPlus, X, Mail, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const inviteByEmail = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteError('');
    setInviting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setMembers((prev) => [...prev, data]);
        setInviteEmail('');
        // WSメンバーリストも更新
        const wsRes = await fetch(`/api/workspaces/${workspaceId}/members`);
        if (wsRes.ok) {
          const { data: wsData } = await wsRes.json();
          setWsMembers(wsData);
        }
      } else {
        const { error } = await res.json().catch(() => ({ error: '招待に失敗しました' }));
        setInviteError(error || '招待に失敗しました');
      }
    } catch {
      setInviteError('招待に失敗しました');
    } finally {
      setInviting(false);
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

          {/* メンバー管理 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-g-text">メンバー管理</h3>

            {/* メール招待フォーム */}
            <div className="space-y-2">
              <p className="text-xs text-g-text-muted">メールアドレスで招待</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') inviteByEmail(); }}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="h-8 shrink-0 bg-[#4285F4] hover:bg-[#3367d6]"
                  onClick={inviteByEmail}
                  disabled={inviting || !inviteEmail.trim()}
                >
                  {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1 h-3.5 w-3.5" />}
                  招待
                </Button>
              </div>
              {inviteError && (
                <p className="text-xs text-red-500">{inviteError}</p>
              )}
            </div>

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
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm text-g-text">
                      {m.user.name ?? m.user.email}
                    </span>
                    {m.user.name && (
                      <span className="block truncate text-[11px] text-g-text-muted">{m.user.email}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeMember(m.userId)}
                    className="rounded p-0.5 text-g-text-muted hover:bg-g-border hover:text-g-text"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* WSメンバーから追加 */}
            {nonMembers.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-g-text-muted">ワークスペースメンバーから追加</p>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
