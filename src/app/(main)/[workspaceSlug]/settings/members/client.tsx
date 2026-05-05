'use client';

import { useState, useRef, useCallback } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserPlus, Trash2, Crown, ShieldCheck, User, Eye, Upload, X, Loader2, ImagePlus, ArrowRightLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  OWNER: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
  ADMIN: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  MEMBER: 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
  VIEWER: 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700',
};

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export function MembersClient({ members: initialMembers, workspaceId, myRole, currentUserId, logoUrl: initialLogoUrl }: MembersClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [transferring, setTransferring] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const [showDeleteLogoDialog, setShowDeleteLogoDialog] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'PNG, JPG, WebP形式のみ対応しています（SVGは非対応）';
    }
    if (file.size > MAX_SIZE) {
      return `ファイルサイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。2MB以下にしてください`;
    }
    return null;
  }

  function setPreview(file: File) {
    // 古いプレビューURLを解放
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      toast({ title: error, variant: 'destructive' });
      return;
    }
    setPreview(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  // D&D handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleFileSelect]);

  async function handleLogoUpload() {
    if (!previewFile) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', previewFile);
      const res = await fetch(`/api/workspaces/${workspaceId}/logo`, {
        method: 'POST',
        body: formData,
      });
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {}
      if (!res.ok) {
        toast({ title: (data.error as string) ?? 'アップロードに失敗しました', variant: 'destructive' });
        return;
      }
      setLogoUrl(data.logoUrl as string);
      clearPreview();
      toast({ title: 'ロゴをアップロードしました' });
    } catch {
      toast({ title: 'アップロードに失敗しました', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleLogoDelete() {
    setDeletingLogo(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/logo`, { method: 'DELETE' });
      if (res.ok) {
        setLogoUrl(null);
        toast({ title: 'ロゴを削除しました' });
      }
    } catch {
      toast({ title: '削除に失敗しました', variant: 'destructive' });
    } finally {
      setDeletingLogo(false);
      setShowDeleteLogoDialog(false);
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

  function canDeleteMember(target: Member): boolean {
    if (target.role === 'OWNER') return false;
    if (!canManage) return false;
    if (target.userId === currentUserId) return false;
    return true;
  }

  function getRoleOptions(): Role[] {
    if (myRole === 'OWNER') return ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    return ['MEMBER', 'VIEWER'];
  }

  async function handleTransferOwnership() {
    if (!transferTargetId) return;
    setTransferring(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toMemberId: transferTargetId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: '移譲に失敗しました', description: data.error ?? '', variant: 'destructive' });
        return;
      }
      // 楽観的UI更新: 自分→ADMIN、対象→OWNER
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === transferTargetId) return { ...m, role: 'OWNER' as Role };
          if (m.userId === currentUserId) return { ...m, role: 'ADMIN' as Role };
          return m;
        }),
      );
      toast({ title: 'オーナー権限を移譲しました', description: '画面を更新します' });
      setTransferDialogOpen(false);
      setTransferTargetId('');
      // 権限変動でUI状態が変わるので確実にリロード
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setTransferring(false);
    }
  }

  // 移譲候補（自分以外、ロール無関係に全員）
  const transferCandidates = members.filter((m) => m.userId !== currentUserId);

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

            <div
              className={cn(
                'relative flex items-center gap-4 rounded-lg border-2 border-dashed p-4 transition-colors',
                dragging ? 'border-blue-400 bg-blue-50/50' : 'border-transparent',
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* ローディングオーバーレイ */}
              {(uploadingLogo || deletingLogo) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70">
                  <Loader2 className="h-6 w-6 animate-spin text-[#4285F4]" />
                </div>
              )}

              {/* プレビュー表示 */}
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt="プレビュー"
                    className="h-16 w-16 rounded-lg border border-g-border object-contain bg-white p-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-g-text truncate">{previewFile?.name}</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="bg-[#4285F4] hover:bg-[#3367D6]"
                      >
                        {uploadingLogo ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />アップロード中...</> : 'アップロード'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearPreview}
                        disabled={uploadingLogo}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                </>
              ) : logoUrl ? (
                <>
                  <img
                    src={logoUrl}
                    alt="ワークスペースロゴ"
                    className="h-16 w-16 rounded-lg border border-g-border object-contain bg-white p-1"
                  />
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-g-border bg-g-bg px-3 py-1.5 text-sm text-g-text hover:bg-g-surface-hover">
                        <Upload className="h-3.5 w-3.5" />
                        変更
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeleteLogoDialog(true)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        削除
                      </Button>
                    </div>
                    <p className="mt-1.5 text-xs text-g-text-muted">ボードビューにウォーターマークとして表示されます</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-g-border text-g-text-muted">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-g-border bg-g-bg px-3 py-1.5 text-sm text-g-text hover:bg-g-surface-hover">
                      <Upload className="h-3.5 w-3.5" />
                      アップロード
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </label>
                    <p className="mt-1.5 text-xs text-g-text-muted">PNG, JPG, WebP / 2MB以下</p>
                    <p className="text-xs text-g-text-muted">ドラッグ&ドロップでもアップロードできます</p>
                  </div>
                </>
              )}
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

        {/* オーナー権限移譲（OWNERのみ） */}
        {myRole === 'OWNER' && transferCandidates.length > 0 && (
          <div className="rounded-lg border border-g-border bg-g-bg p-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-g-text">
              <ArrowRightLeft className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              オーナー権限の移譲
            </h2>
            <p className="mb-3 text-xs text-g-text-secondary">
              他のメンバーに OWNER 権限を移譲します。あなたは ADMIN に降格します（不可逆）。
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferDialogOpen(true)}
              className="border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-950"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              オーナー権限を移譲する
            </Button>
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
                {canDeleteMember(member) ? (
                  <button
                    onClick={() => setDeleteTarget(member)}
                    className="rounded-md p-1.5 text-g-text-muted transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 dark:hover:text-red-400"
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

      {/* メンバー削除確認ダイアログ */}
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

      {/* オーナー権限移譲ダイアログ */}
      <Dialog open={transferDialogOpen} onOpenChange={(o) => { if (!transferring) setTransferDialogOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              オーナー権限を移譲
            </DialogTitle>
            <DialogDescription>
              移譲先メンバーを選択してください。あなたは <strong>ADMIN</strong> に降格します。
              この操作は不可逆です。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-g-text-secondary">移譲先</label>
            <Select value={transferTargetId} onValueChange={setTransferTargetId}>
              <SelectTrigger className="w-full border-g-border">
                <SelectValue placeholder="メンバーを選択..." />
              </SelectTrigger>
              <SelectContent>
                {transferCandidates.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <span>{m.user.name ?? m.user.email ?? '名前未設定'}</span>
                      <span className="text-xs text-g-text-muted">
                        ({ROLE_LABELS[m.role]})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {transferTargetId && (
              <div className="mt-3 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-200">
                ⚠️ 移譲後、あなたは ADMIN になります。再度 OWNER に戻すには新オーナーから移譲してもらう必要があります。
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
              disabled={transferring}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleTransferOwnership}
              disabled={!transferTargetId || transferring}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {transferring ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" />移譲中...</>
              ) : (
                '移譲する'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ロゴ削除確認ダイアログ */}
      <AlertDialog open={showDeleteLogoDialog} onOpenChange={setShowDeleteLogoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ロゴを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              ワークスペースロゴを削除します。ボードビューのウォーターマークも表示されなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLogo}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogoDelete}
              disabled={deletingLogo}
              className="bg-red-500 hover:bg-red-600"
            >
              {deletingLogo ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />削除中...</> : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
