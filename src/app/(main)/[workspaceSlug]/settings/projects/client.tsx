'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { FolderKanban, Lock, Globe, Users, Plus, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { eventBus, EVENTS } from '@/lib/event-bus';

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface ProjectMember {
  id: string;
  userId: string;
  user: UserInfo;
}

interface ProjectData {
  id: string;
  name: string;
  color: string;
  isPrivate: boolean;
  members: ProjectMember[];
}

interface WsMember {
  id: string;
  userId: string;
  role: string;
  user: UserInfo;
}

interface Props {
  projects: ProjectData[];
  workspaceMembers: WsMember[];
  workspaceId: string;
}

export function ProjectsSettingsClient({ projects: initial, workspaceMembers, workspaceId }: Props) {
  const [projects, setProjects] = useState<ProjectData[]>(initial);
  const [memberDialogProject, setMemberDialogProject] = useState<ProjectData | null>(null);

  const handleTogglePrivate = async (projectId: string, isPrivate: boolean) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrivate }),
      });
      if (!res.ok) {
        toast({ title: '変更に失敗しました', variant: 'destructive' });
        return;
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, isPrivate } : p))
      );
      eventBus.emit(EVENTS.PROJECTS_CHANGED);
      toast({ title: isPrivate ? 'プロジェクトを非公開にしました' : 'プロジェクトを公開にしました' });
    } catch {
      toast({ title: '変更に失敗しました', variant: 'destructive' });
    }
  };

  const handleAddMembers = async (projectId: string, userIds: string[]) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      if (!res.ok) {
        toast({ title: 'メンバー追加に失敗しました', variant: 'destructive' });
        return;
      }
      const members = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, members } : p))
      );
      if (memberDialogProject?.id === projectId) {
        setMemberDialogProject((prev) => prev ? { ...prev, members } : null);
      }
      toast({ title: 'メンバーを追加しました' });
    } catch {
      toast({ title: 'メンバー追加に失敗しました', variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (projectId: string, userId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        toast({ title: 'メンバー削除に失敗しました', variant: 'destructive' });
        return;
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, members: p.members.filter((m) => m.userId !== userId) }
            : p
        )
      );
      if (memberDialogProject?.id === projectId) {
        setMemberDialogProject((prev) =>
          prev ? { ...prev, members: prev.members.filter((m) => m.userId !== userId) } : null
        );
      }
    } catch {
      toast({ title: 'メンバー削除に失敗しました', variant: 'destructive' });
    }
  };

  const openMemberDialog = (project: ProjectData) => {
    setMemberDialogProject(project);
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Role descriptions */}
        <div className="rounded-lg border border-g-border bg-g-bg p-4">
          <h3 className="mb-2 text-sm font-semibold text-g-text">アクセス権の仕組み</h3>
          <ul className="space-y-1 text-xs text-g-text-secondary">
            <li><strong>OWNER / ADMIN</strong>: 全プロジェクト（公開・非公開）にアクセス可能</li>
            <li><strong>MEMBER / VIEWER</strong>: 公開プロジェクト + 招待された非公開プロジェクトのみ</li>
          </ul>
        </div>

        {/* Project list */}
        <div className="rounded-lg border border-g-border bg-g-bg">
          <div className="border-b border-g-border px-5 py-3">
            <h2 className="text-sm font-semibold text-g-text">
              プロジェクト <span className="ml-1 text-g-text-secondary">({projects.length})</span>
            </h2>
          </div>

          {projects.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-g-text-muted">
              プロジェクトがありません
            </div>
          ) : (
            <ul className="divide-y divide-g-border">
              {projects.map((project) => (
                <li key={project.id} className="flex items-center gap-4 px-5 py-3.5">
                  <FolderKanban className="h-4 w-4 shrink-0" style={{ color: project.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-g-text">{project.name}</p>
                    {project.isPrivate && (
                      <p className="text-xs text-g-text-muted">
                        メンバー: {project.members.length}人
                      </p>
                    )}
                  </div>

                  {/* Public/Private toggle */}
                  <div className="flex items-center gap-2">
                    {project.isPrivate ? (
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-green-500" />
                    )}
                    <span className="text-xs text-g-text-secondary w-12">
                      {project.isPrivate ? '非公開' : '公開'}
                    </span>
                    <Switch
                      checked={project.isPrivate}
                      onCheckedChange={(checked) => handleTogglePrivate(project.id, checked)}
                    />
                  </div>

                  {/* Members button */}
                  {project.isPrivate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => openMemberDialog(project)}
                    >
                      <Users className="h-3 w-3" />
                      管理
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Member management dialog */}
      {memberDialogProject && (
        <MemberDialog
          project={memberDialogProject}
          workspaceMembers={workspaceMembers}
          onClose={() => setMemberDialogProject(null)}
          onAddMembers={handleAddMembers}
          onRemoveMember={handleRemoveMember}
        />
      )}
    </div>
  );
}

function MemberDialog({
  project,
  workspaceMembers,
  onClose,
  onAddMembers,
  onRemoveMember,
}: {
  project: ProjectData;
  workspaceMembers: WsMember[];
  onClose: () => void;
  onAddMembers: (projectId: string, userIds: string[]) => void;
  onRemoveMember: (projectId: string, userId: string) => void;
}) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const existingMemberIds = new Set(project.members.map((m) => m.userId));
  const availableMembers = workspaceMembers.filter(
    (wm) => !existingMemberIds.has(wm.userId) && wm.role !== 'OWNER' && wm.role !== 'ADMIN'
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleAdd = () => {
    if (selectedUserIds.size > 0) {
      onAddMembers(project.id, Array.from(selectedUserIds));
      setSelectedUserIds(new Set());
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" style={{ color: project.color }} />
            {project.name} のメンバー管理
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current members */}
          <div>
            <h4 className="mb-2 text-xs font-semibold text-g-text-muted">現在のメンバー ({project.members.length})</h4>
            {project.members.length === 0 ? (
              <p className="text-xs text-g-text-muted">メンバーがいません</p>
            ) : (
              <ul className="space-y-1.5">
                {project.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-g-surface-hover">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.user.image ?? ''} />
                      <AvatarFallback className="bg-[#4285F4] text-[10px] text-white">
                        {m.user.name?.charAt(0) ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm text-g-text">{m.user.name ?? m.user.email}</span>
                    <button
                      onClick={() => onRemoveMember(project.id, m.userId)}
                      className="rounded p-0.5 text-g-text-muted hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add members */}
          {availableMembers.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-g-text-muted">メンバーを追加</h4>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {availableMembers.map((wm) => {
                  const checked = selectedUserIds.has(wm.userId);
                  return (
                    <li
                      key={wm.userId}
                      onClick={() => toggleUser(wm.userId)}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                        checked ? 'bg-[#4285F4]/10 ring-1 ring-[#4285F4]/30' : 'hover:bg-g-surface-hover'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(wm.userId)}
                        className="h-3.5 w-3.5 rounded border-g-border accent-[#4285F4]"
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={wm.user.image ?? ''} />
                        <AvatarFallback className="bg-gray-400 text-[10px] text-white">
                          {wm.user.name?.charAt(0) ?? 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-g-text">{wm.user.name ?? '名前未設定'}</p>
                        <p className="truncate text-[11px] text-g-text-muted">{wm.user.email}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>閉じる</Button>
          {selectedUserIds.size > 0 && (
            <Button onClick={handleAdd} className="bg-[#4285F4] hover:bg-[#3367D6] gap-1">
              <Plus className="h-3.5 w-3.5" />
              {selectedUserIds.size}人を追加
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
