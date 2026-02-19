'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Calendar, Clock, Flag, Tag, Users, CheckSquare } from 'lucide-react';
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
];

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  estimatedHours: number | null;
  googleCalendarEventId: string | null;
  googleCalendarSyncedAt: string | null;
  googleTaskId: string | null;
  googleTaskSyncedAt: string | null;
  subtasks: { id: string; title: string; status: string }[];
  assignees: { id: string; user: { id: string; name: string | null; image: string | null } }[];
  labels: { id: string; label: { id: string; name: string; color: string } }[];
  comments: { id: string; content: string; createdAt: string; user: { id: string; name: string | null; email: string; image: string | null } }[];
  attachments: { id: string; name: string; mimeType: string; url: string; driveFileId: string; iconUrl: string | null; size: number | null; createdAt: string }[];
}

export function TaskDetailPanel() {
  const { activeTaskId, close } = useTaskPanelStore();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const isUpdatingRef = useRef(false);

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
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto p-0">
        {task && (
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E8EAED] px-4 py-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={task.status === 'DONE'}
                  onCheckedChange={(checked) =>
                    updateField('status', checked ? 'DONE' : 'TODO')
                  }
                />
                <span className="text-xs text-[#80868B]">
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
                className="w-full resize-none bg-transparent text-lg font-semibold text-[#202124] outline-none"
                rows={1}
              />
            </div>

            {/* Properties */}
            <div className="space-y-3 px-4 py-4">
              {/* Status */}
              <div className="flex items-center gap-3">
                <CheckSquare className="h-4 w-4 text-[#80868B]" />
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
                <Flag className="h-4 w-4 text-[#80868B]" />
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

              {/* Due date */}
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-[#80868B]" />
                <input
                  type="date"
                  value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                  onChange={(e) =>
                    updateField(
                      'dueDate',
                      e.target.value ? new Date(e.target.value).toISOString() : null
                    )
                  }
                  className="h-8 rounded-md border border-[#E8EAED] px-2 text-xs text-[#202124]"
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
                <Clock className="h-4 w-4 text-[#80868B]" />
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
                    className="text-xs text-[#80868B] hover:text-[#EA4335]"
                  >
                    クリア
                  </button>
                )}
              </div>

              {/* Assignees */}
              {task.assignees.length > 0 && (
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-[#80868B]" />
                  <div className="flex flex-wrap gap-1">
                    {task.assignees.map((a) => (
                      <Badge key={a.id} variant="secondary" className="text-xs">
                        {a.user.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Labels */}
              {task.labels.length > 0 && (
                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4 text-[#80868B]" />
                  <div className="flex flex-wrap gap-1">
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
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="border-t border-[#E8EAED] px-4 py-4">
              <label className="mb-2 block text-xs font-medium text-[#5F6368]">
                説明
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="説明を追加..."
                className="min-h-[80px] resize-none border-[#E8EAED] text-sm"
              />
            </div>

            {/* Subtasks */}
            <div className="border-t border-[#E8EAED] px-4 py-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-[#5F6368]">
                  サブタスク
                </label>
                {totalSubtasks > 0 && (
                  <span className="text-xs text-[#80868B]">
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                )}
              </div>

              {totalSubtasks > 0 && (
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#E8EAED]">
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
                    className="flex items-center gap-2 rounded px-1 py-1 hover:bg-[#F8F9FA]"
                  >
                    <Checkbox
                      checked={sub.status === 'DONE'}
                      onCheckedChange={() => toggleSubtask(sub.id, sub.status)}
                    />
                    <span
                      className={cn(
                        'text-sm text-[#202124]',
                        sub.status === 'DONE' && 'text-[#80868B] line-through'
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
                className="mt-2 w-full rounded-md border border-[#E8EAED] px-3 py-1.5 text-sm outline-none focus:border-[#4285F4]"
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
            />

            {/* Activity Log */}
            <div className="border-t border-[#E8EAED]">
              <label className="block px-4 pt-4 text-xs font-medium text-[#5F6368]">
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
