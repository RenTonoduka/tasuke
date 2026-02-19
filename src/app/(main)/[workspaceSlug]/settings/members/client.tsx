'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserPlus, Trash2, Crown, ShieldCheck, User, Eye } from 'lucide-react';

type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface MemberUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Member {
  id: string;
  role: Role;
  joinedAt: string;
  userId: string;
  user: MemberUser;
}

interface MembersClientProps {
  members: Member[];
  workspaceId: string;
  myRole: Role;
  currentUserId: string;
}

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'オーナー',
  ADMIN: '管理者',
  MEMBER: 'メンバー',
  VIEWER: '閲覧者',
};

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  OWNER: <Crown className="h-3.5 w-3.5 text-yellow-500" />,
  ADMIN: <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />,
  MEMBER: <User className="h-3.5 w-3.5 text-gray-500" />,
  VIEWER: <Eye className="h-3.5 w-3.5 text-gray-400" />,
};

const ROLE_COLORS: Record<Role, string> = {
  OWNER: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  ADMIN: 'bg-blue-50 text-blue-700 border border-blue-200',
  MEMBER: 'bg-gray-50 text-gray-600 border border-gray-200',
  VIEWER: 'bg-gray-50 text-gray-400 border border-gray-200',
};

export function MembersClient({ members: initialMembers, workspaceId, myRole, currentUserId }: MembersClientProps) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? '招待に失敗しました');
        return;
      }
      setMembers((prev) => [...prev, data]);
      setInviteEmail('');
      router.refresh();
    } catch {
      setInviteError('ネットワークエラーが発生しました');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, role: Role) {
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? 'ロール変更に失敗しました');
      return;
    }
    const updated = await res.json();
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? '削除に失敗しました');
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  function canChangeRole(target: Member): boolean {
    if (target.role === 'OWNER') return false;
    if (target.userId === currentUserId) return false;
    if (myRole === 'OWNER') return true;
    if (myRole === 'ADMIN' && ['MEMBER', 'VIEWER'].includes(target.role)) return true;
    return false;
  }

  function canDelete(target: Member): boolean {
    if (target.role === 'OWNER') return false;
    if (!canManage) return false;
    if (target.userId === currentUserId) return false;
    return true;
  }

  function getRoleOptions(): Role[] {
    if (myRole === 'OWNER') return ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    return ['MEMBER', 'VIEWER'];
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* 招待フォーム */}
        {canManage && (
          <div className="rounded-lg border border-[#E8EAED] bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#202124]">
              <UserPlus className="h-4 w-4 text-[#4285F4]" />
              メンバーを招待
            </h2>
            <form onSubmit={handleInvite} className="flex items-start gap-3">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="メールアドレスを入力"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="border-[#E8EAED] focus-visible:ring-[#4285F4]"
                  disabled={inviting}
                />
                {inviteError && (
                  <p className="mt-1 text-xs text-red-500">{inviteError}</p>
                )}
              </div>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as 'ADMIN' | 'MEMBER' | 'VIEWER')}
              >
                <SelectTrigger className="w-32 border-[#E8EAED]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {myRole === 'OWNER' && (
                    <SelectItem value="ADMIN">管理者</SelectItem>
                  )}
                  <SelectItem value="MEMBER">メンバー</SelectItem>
                  <SelectItem value="VIEWER">閲覧者</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="bg-[#4285F4] hover:bg-[#3367D6]"
              >
                {inviting ? '招待中...' : '招待'}
              </Button>
            </form>
          </div>
        )}

        {/* メンバー一覧 */}
        <div className="rounded-lg border border-[#E8EAED] bg-white">
          <div className="border-b border-[#E8EAED] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#202124]">
              メンバー <span className="ml-1 text-[#5F6368]">({members.length})</span>
            </h2>
          </div>

          <ul className="divide-y divide-[#E8EAED]">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-4 px-5 py-3.5">
                {/* アバター */}
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={member.user.image ?? ''} />
                  <AvatarFallback className="bg-[#4285F4] text-sm text-white">
                    {member.user.name?.charAt(0) ?? member.user.email?.charAt(0) ?? 'U'}
                  </AvatarFallback>
                </Avatar>

                {/* 名前・メール */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#202124]">
                    {member.user.name ?? '名前未設定'}
                    {member.userId === currentUserId && (
                      <span className="ml-2 text-xs text-[#80868B]">（自分）</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-[#5F6368]">{member.user.email}</p>
                </div>

                {/* ロールバッジ / ドロップダウン */}
                {canChangeRole(member) ? (
                  <Select
                    value={member.role}
                    onValueChange={(v) => handleRoleChange(member.id, v as Role)}
                  >
                    <SelectTrigger className="h-7 w-28 border-[#E8EAED] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getRoleOptions().map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[member.role]}`}
                  >
                    {ROLE_ICONS[member.role]}
                    {ROLE_LABELS[member.role]}
                  </span>
                )}

                {/* 削除ボタン */}
                {canDelete(member) ? (
                  <button
                    onClick={() => setDeleteTarget(member)}
                    className="rounded-md p-1.5 text-[#80868B] transition-colors hover:bg-red-50 hover:text-red-500"
                    title="メンバーを削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="w-8" />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>メンバーを削除</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-[#202124]">
                {deleteTarget?.user.name ?? deleteTarget?.user.email}
              </span>{' '}
              をワークスペースから削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '削除中...' : '削除する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
