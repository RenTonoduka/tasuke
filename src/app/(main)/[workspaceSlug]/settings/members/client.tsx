'use client';

import { useState } from 'react';
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
import { UserPlus, Trash2, Crown, ShieldCheck, User, Eye, Upload, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  logoUrl?: string | null;
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

export function MembersClient({ members: initialMembers, workspaceId, myRole, currentUserId, logoUrl: initialLogoUrl }: MembersClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch(`/api/workspaces/${workspaceId}/logo`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error ?? 'アップロードに失敗しました', variant: 'destructive' });
        return;
      }
      const data = await res.json();
      setLogoUrl(data.logoUrl);
      toast({ title: 'ロゴをアップロードしました' });
    } catch {
      toast({ title: 'アップロードに失敗しました', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  }

  async function handleLogoDelete() {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/logo`, { method: 'DELETE' });
      if (res.ok) {
        setLogoUrl(null);
        toast({ title: 'ロゴを削除しました' });
      }
    } catch {
      toast({ title: '削除に失敗しました', variant: 'destructive' });
    }
  }

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

        {/* ロゴ設定 */}
        {canManage && (
          <div className="rounded-lg border border-g-border bg-g-bg p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-g-text">
              <Upload className="h-4 w-4 text-[#4285F4]" />
              ワークスペースロゴ
            </h2>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative">
                  <img
                    src={logoUrl}
                    alt="ワークスペースロゴ"
                    className="h-16 w-16 rounded-lg border border-g-border object-contain bg-white p-1"
                  />
                  <button
                    onClick={handleLogoDelete}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-g-border text-g-text-muted">
                  <Upload className="h-6 w-6" />
                </div>
              )}
              <div className="flex-1">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-g-border bg-g-bg px-3 py-1.5 text-sm text-g-text hover:bg-g-surface-hover">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingLogo ? 'アップロード中...' : logoUrl ? '変更' : 'アップロード'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                </label>
                <p className="mt-1.5 text-xs text-g-text-muted">PNG, JPG, SVG, WebP / 2MB以下</p>
                {logoUrl && (
                  <p className="mt-0.5 text-xs text-g-text-muted">ボードビューにウォーターマークとして表示されます</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ロール説明 */}
        <div className="rounded-lg border border-g-border bg-g-bg p-4">
          <h3 className="mb-2 text-sm font-semibold text-g-text">ロールについて</h3>
          <ul className="space-y-1 text-xs text-g-text-secondary">
            <li><strong>オーナー</strong>: ワークスペースの全管理権限。全プロジェクトにアクセス可能</li>
            <li><strong>管理者</strong>: メンバー管理・プロジェクト設定が可能。全プロジェクトにアクセス可能</li>
            <li><strong>メンバー</strong>: 公開プロジェクト + 招待された非公開プロジェクトにアクセス可能</li>
            <li><strong>閲覧者</strong>: 公開プロジェクト + 招待された非公開プロジェクトを閲覧のみ</li>
          </ul>
        </div>

        {/* 招待フォーム */}
        {canManage && (
          <div className="rounded-lg border border-g-border bg-g-bg p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-g-text">
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
                  className="border-g-border focus-visible:ring-[#4285F4]"
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
                <SelectTrigger className="w-32 border-g-border">
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
        <div className="rounded-lg border border-g-border bg-g-bg">
          <div className="border-b border-g-border px-5 py-3">
            <h2 className="text-sm font-semibold text-g-text">
              メンバー <span className="ml-1 text-g-text-secondary">({members.length})</span>
            </h2>
          </div>

          <ul className="divide-y divide-g-border">
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
                  <p className="truncate text-sm font-medium text-g-text">
                    {member.user.name ?? '名前未設定'}
                    {member.userId === currentUserId && (
                      <span className="ml-2 text-xs text-g-text-muted">（自分）</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-g-text-secondary">{member.user.email}</p>
                </div>

                {/* ロールバッジ / ドロップダウン */}
                {canChangeRole(member) ? (
                  <Select
                    value={member.role}
                    onValueChange={(v) => handleRoleChange(member.id, v as Role)}
                  >
                    <SelectTrigger className="h-7 w-28 border-g-border text-xs">
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
                    className="rounded-md p-1.5 text-g-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
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
              <span className="font-medium text-g-text">
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
