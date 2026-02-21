'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Calendar, Clock, Flag, Tag, Users, CheckSquare, GripVertical, UserPlus, Check } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { cn } from '@/lib/utils';
import { ActivityLog } from './activity-log';
import { CommentSection } from './comment-section';
import { CalendarSyncButton } from './calendar-sync-button';
import { GTasksSyncButton } from './gtasks-sync-button';
import { AttachmentList } from './attachment-list';

const priorityOptions = [
  { value: 'P0', label: 'P0 - 緊急', color: '#EA4335' },
  { value: 'P1', label: 'P1 - 高', color: '#FBBC04' },
  { value: 'P2', label: 'P2 - 中', color: '#4285F4' },
  { value: 'P3', label: 'P3 - 低', color: '#80868B' },
];

const statusOptions = [
  { value: 'TODO', label: 'Todo' },
  { value: 'IN_PROGRESS', label: '進行中' },
  { value: 'DONE', label: '完了' },
  { value: 'ARCHIVED', label: 'アーカイブ' },
];

interface WorkspaceMember {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  googleCalendarEventId: string | null;
  googleCalendarSyncedAt: string | null;
  googleTaskId: string | null;
  googleTaskSyncedAt: string | null;
  project: { workspaceId: string };
  subtasks: { id: string; title: string; status: string }[];
  assignees: { id: string; user: { id: string; name: string | null; image: string | null } }[];
  labels: { id: string; label: { id: string; name: string; color: string } }[];
  comments: { id: string; content: string; createdAt: string; user: { id: string; name: string | null; email: string; image: string | null } }[];
  attachments: { id: string; name: string; mimeType: string; url: string; driveFileId: string; iconUrl: string | null; size: number | null; createdAt: string }[];
}

const MIN_WIDTH = 380;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 480;

export function TaskDetailPanel() {
  const { activeTaskId, close } = useTaskPanelStore();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const isUpdatingRef = useRef(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const isResizingRef = useRef(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<{ id: string; name: string; color: string }[]>([]);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMove = (ev: PointerEvent) => {
      if (!isResizingRef.current) return;
      const delta = startX - ev.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const handleUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [panelWidth]);

  const fetchTask = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`);
    if (!res.ok) {
      console.error(`タスク取得失敗: ${res.status} ${res.statusText}`);
      return;
    }
    const data = await res.json();
    setTask(data);
    setTitle(data.title);
    setDescription(data.description ?? '');
  }, []);

  useEffect(() => {
    if (activeTaskId) fetchTask(activeTaskId);
  }, [activeTaskId, fetchTask]);

  // メンバー取得（Popover展開時）
  const fetchMembers = useCallback(async () => {
    if (!task?.project?.workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${task.project.workspaceId}/members`);
      if (res.ok) setMembers(await res.json());
    } catch {}
  }, [task?.project?.workspaceId]);

  useEffect(() => {
    if (assigneeOpen) fetchMembers();
  }, [assigneeOpen, fetchMembers]);

  // ラベル取得（Popover展開時）
  const fetchLabels = useCallback(async () => {
    if (!task?.project?.workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${task.project.workspaceId}/labels`);
      if (res.ok) setAvailableLabels(await res.json());
    } catch {}
  }, [task?.project?.workspaceId]);

  useEffect(() => {
    if (labelOpen) fetchLabels();
  }, [labelOpen, fetchLabels]);

  const toggleLabel = async (labelId: string) => {
    if (!task) return;
    const currentIds = task.labels.map((l) => l.label.id);
    const newIds = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId];
    try {
      const res = await fetch(`/api/tasks/${task.id}/labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelIds: newIds }),
      });
      if (res.ok) fetchTask(task.id);
    } catch {}
  };

  const toggleAssignee = async (userId: string) => {
    if (!task) return;
    const currentIds = task.assignees.map((a) => a.user.id);
    const newIds = currentIds.includes(userId)
      ? currentIds.filter((id) => id !== userId)
      : [...currentIds, userId];

    try {
      await fetch(`/api/tasks/${task.id}/assignees`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: newIds }),
      });
      fetchTask(task.id);
    } catch {}
  };

  const updateField = async (field: string, value: unknown) => {
    if (!task) return;
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        console.error(`フィールド更新失敗 (${field}): ${res.status} ${res.statusText}`);
        return;
      }
      await fetchTask(task.id);
    } catch (error) {
      console.error(`フィールド更新エラー (${field}):`, error);
    } finally {
      isUpdatingRef.current = false;
    }
  };

  const handleTitleBlur = () => {
    if (task && title !== task.title && title.trim()) {
      updateField('title', title.trim());
    }
  };

  const handleDescBlur = () => {
    if (task && description !== (task.description ?? '')) {
      updateField('description', description || null);
    }
  };

  const addSubtask = async () => {
    if (!task || !newSubtask.trim()) return;
    const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSubtask.trim() }),
    });
    if (!res.ok) {
      console.error('サブタスク作成に失敗');
      return;
    }
    setNewSubtask('');
    fetchTask(task.id);
  };

  const toggleSubtask = async (subtaskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
    const res = await fetch(`/api/tasks/${subtaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      console.error('サブタスク更新に失敗');
      return;
    }
    if (task) fetchTask(task.id);
  };

  const completedSubtasks = task?.subtasks.filter((s) => s.status === 'DONE').length ?? 0;
  const totalSubtasks = task?.subtasks.length ?? 0;

  return (
    <Sheet open={!!activeTaskId} onOpenChange={(open) => !open && close()}>
      <SheetContent
        className="overflow-y-auto p-0 !w-full"
        style={{ maxWidth: panelWidth }}
      >
        {/* リサイズハンドル */}
        <div
          onPointerDown={handleResizeStart}
          className="absolute left-0 top-0 z-50 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-[#4285F4]/10 active:bg-[#4285F4]/20"
          style={{ touchAction: 'none' }}
        >
          <div className="h-8 w-1 rounded-full bg-g-border" />
        </div>
        {task && (
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-g-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={task.status === 'DONE'}
                  onCheckedChange={(checked) =>
                    updateField('status', checked ? 'DONE' : 'TODO')
                  }
                />
                <span className="text-xs text-g-text-muted">
                  {task.status === 'DONE' ? '完了' : '未完了'}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Title */}
            <div className="px-4 pt-4">
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                className="w-full resize-none bg-transparent text-lg font-semibold text-g-text outline-none"
                rows={1}
              />
            </div>

            {/* Properties */}
            <div className="space-y-3 px-4 py-4">
              {/* Status */}
              <div className="flex items-center gap-3">
                <CheckSquare className="h-4 w-4 text-g-text-muted" />
                <Select
                  value={task.status}
                  onValueChange={(v) => updateField('status', v)}
                >
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-3">
                <Flag className="h-4 w-4 text-g-text-muted" />
                <Select
                  value={task.priority}
                  onValueChange={(v) => updateField('priority', v)}
                >
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: o.color }}
                          />
                          {o.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start date */}
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-g-text-muted" />
                <span className="text-xs text-g-text-muted w-12">開始</span>
                <input
                  type="date"
                  value={task.startDate ? task.startDate.split('T')[0] : ''}
                  onChange={(e) =>
                    updateField(
                      'startDate',
                      e.target.value ? new Date(e.target.value).toISOString() : null
                    )
                  }
                  className="h-8 rounded-md border border-g-border px-2 text-xs text-g-text"
                />
              </div>

              {/* Due date */}
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-g-text-muted" />
                <span className="text-xs text-g-text-muted w-12">期限</span>
                <input
                  type="date"
                  value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                  onChange={(e) =>
                    updateField(
                      'dueDate',
                      e.target.value ? new Date(e.target.value).toISOString() : null
                    )
                  }
                  className="h-8 rounded-md border border-g-border px-2 text-xs text-g-text"
                />
              </div>

              {/* Google連携ボタン */}
              <div className="flex flex-wrap items-center gap-2 pl-7">
                <CalendarSyncButton
                  taskId={task.id}
                  googleCalendarEventId={task.googleCalendarEventId}
                  googleSyncedAt={task.googleCalendarSyncedAt}
                  dueDate={task.dueDate}
                  onSync={() => fetchTask(task.id)}
                />
                <GTasksSyncButton
                  taskId={task.id}
                  googleTaskId={task.googleTaskId}
                  googleSyncedAt={task.googleTaskSyncedAt}
                  onSync={() => fetchTask(task.id)}
                />
              </div>

              {/* Estimated Hours */}
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-g-text-muted" />
                <Select
                  value={task.estimatedHours?.toString() ?? ''}
                  onValueChange={(v) => updateField('estimatedHours', v ? parseFloat(v) : null)}
                >
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="見積もり時間" />
                  </SelectTrigger>
                  <SelectContent>
                    {[0.5, 1, 1.5, 2, 3, 4, 5, 6, 8].map((h) => (
                      <SelectItem key={h} value={h.toString()}>
                        {h}時間
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {task.estimatedHours && (
                  <button
                    onClick={() => updateField('estimatedHours', null)}
                    className="text-xs text-g-text-muted hover:text-[#EA4335]"
                  >
                    クリア
                  </button>
                )}
              </div>

              {/* Assignees */}
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-g-text-muted" />
                <div className="flex flex-1 flex-wrap items-center gap-1">
                  {task.assignees.map((a) => (
                    <div key={a.id} className="flex items-center gap-1 rounded-full bg-g-surface-hover py-0.5 pl-0.5 pr-2 text-xs text-g-text">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={a.user.image ?? ''} />
                        <AvatarFallback className="bg-[#4285F4] text-[10px] text-white">
                          {a.user.name?.charAt(0) ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      {a.user.name}
                    </div>
                  ))}
                  <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex h-6 items-center gap-1 rounded-full border border-dashed border-g-border px-2 text-xs text-g-text-muted hover:border-g-text-secondary hover:text-g-text-secondary">
                        <UserPlus className="h-3 w-3" />
                        割り当て
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" align="start">
                      <div className="px-2 py-1.5 text-xs font-medium text-g-text-secondary">メンバー</div>
                      {members.map((m) => {
                        const isAssigned = task.assignees.some((a) => a.user.id === m.user.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleAssignee(m.user.id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-g-surface-hover"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={m.user.image ?? ''} />
                              <AvatarFallback className="bg-[#4285F4] text-[10px] text-white">
                                {m.user.name?.charAt(0) ?? '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate text-left text-g-text">{m.user.name ?? m.user.email}</span>
                            {isAssigned && <Check className="h-4 w-4 text-[#34A853]" />}
                          </button>
                        );
                      })}
                      {members.length === 0 && (
                        <div className="px-2 py-3 text-center text-xs text-g-text-muted">メンバーなし</div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Labels */}
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 text-g-text-muted" />
                <div className="flex flex-1 flex-wrap items-center gap-1">
                  {task.labels.map((tl) => (
                    <Badge
                      key={tl.id}
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: tl.label.color + '20',
                        color: tl.label.color,
                      }}
                    >
                      {tl.label.name}
                    </Badge>
                  ))}
                  <Popover open={labelOpen} onOpenChange={setLabelOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex h-6 items-center gap-1 rounded-full border border-dashed border-g-border px-2 text-xs text-g-text-muted hover:border-g-text-secondary hover:text-g-text-secondary">
                        <Tag className="h-3 w-3" />
                        ラベル
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" align="start">
                      <div className="px-2 py-1.5 text-xs font-medium text-g-text-secondary">ラベル</div>
                      {availableLabels.map((label) => {
                        const isAttached = task.labels.some((tl) => tl.label.id === label.id);
                        return (
                          <button
                            key={label.id}
                            onClick={() => toggleLabel(label.id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-g-surface-hover"
                          >
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: label.color }}
                            />
                            <span className="flex-1 truncate text-left text-g-text">{label.name}</span>
                            {isAttached && <Check className="h-4 w-4 text-[#34A853]" />}
                          </button>
                        );
                      })}
                      {availableLabels.length === 0 && (
                        <div className="px-2 py-3 text-center text-xs text-g-text-muted">ラベルなし</div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-g-border px-4 py-4">
              <label className="mb-2 block text-xs font-medium text-g-text-secondary">
                説明
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="説明を追加..."
                className="min-h-[80px] resize-none border-g-border text-sm"
              />
            </div>

            {/* Subtasks */}
            <div className="border-t border-g-border px-4 py-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-g-text-secondary">
                  サブタスク
                </label>
                {totalSubtasks > 0 && (
                  <span className="text-xs text-g-text-muted">
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                )}
              </div>

              {totalSubtasks > 0 && (
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-g-border">
                  <div
                    className="h-full rounded-full bg-[#34A853] transition-all"
                    style={{
                      width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%`,
                    }}
                  />
                </div>
              )}

              <div className="space-y-1">
                {task.subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-2 rounded px-1 py-1 hover:bg-g-surface"
                  >
                    <Checkbox
                      checked={sub.status === 'DONE'}
                      onCheckedChange={() => toggleSubtask(sub.id, sub.status)}
                    />
                    <span
                      className={cn(
                        'text-sm text-g-text',
                        sub.status === 'DONE' && 'text-g-text-muted line-through'
                      )}
                    >
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>

              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                placeholder="サブタスクを追加..."
                className="mt-2 w-full rounded-md border border-g-border px-3 py-1.5 text-sm outline-none focus:border-[#4285F4]"
              />
            </div>

            {/* Attachments */}
            <AttachmentList
              taskId={task.id}
              attachments={task.attachments ?? []}
              onChanged={() => fetchTask(task.id)}
            />

            {/* Comments */}
            <CommentSection
              taskId={task.id}
              comments={task.comments}
              onCommentAdded={() => fetchTask(task.id)}
              workspaceId={task.project?.workspaceId}
            />

            {/* Activity Log */}
            <div className="border-t border-g-border">
              <label className="block px-4 pt-4 text-xs font-medium text-g-text-secondary">
                アクティビティ
              </label>
              <ActivityLog taskId={task.id} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
