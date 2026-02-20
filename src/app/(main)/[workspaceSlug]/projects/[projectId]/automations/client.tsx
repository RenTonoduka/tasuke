'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Pencil, Zap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Header } from '@/components/layout/header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Record<string, unknown>;
  action: Record<string, unknown>;
}

interface AutomationsClientProps {
  project: { id: string; name: string };
  initialRules: AutomationRule[];
  workspaceSlug: string;
}

const STATUS_OPTIONS = [
  { value: 'TODO', label: '未着手' },
  { value: 'IN_PROGRESS', label: '進行中' },
  { value: 'DONE', label: '完了' },
  { value: 'ARCHIVED', label: 'アーカイブ' },
];

const PRIORITY_OPTIONS = [
  { value: 'P0', label: 'P0 (緊急)' },
  { value: 'P1', label: 'P1 (高)' },
  { value: 'P2', label: 'P2 (中)' },
  { value: 'P3', label: 'P3 (低)' },
];

function describeTrigger(trigger: Record<string, unknown>): string {
  if (trigger.type === 'STATUS_CHANGE') {
    const from = trigger.from ? `「${labelStatus(trigger.from as string)}」から` : '';
    const to = `「${labelStatus(trigger.to as string)}」に変更されたとき`;
    return `ステータスが${from}${to}`;
  }
  if (trigger.type === 'PRIORITY_CHANGE') {
    return `優先度が「${trigger.to}」に変更されたとき`;
  }
  if (trigger.type === 'DUE_DATE_APPROACHING') {
    return `期限の${trigger.daysBefore}日前`;
  }
  return '不明なトリガー';
}

function describeAction(action: Record<string, unknown>): string {
  if (action.type === 'NOTIFY_ASSIGNEES') {
    return action.message ? `担当者に通知：「${action.message}」` : '担当者に通知';
  }
  if (action.type === 'SET_PRIORITY') return `優先度を「${action.priority}」に設定`;
  if (action.type === 'MOVE_SECTION') return `セクション「${action.sectionName}」に移動`;
  if (action.type === 'ADD_LABEL') return `ラベル「${action.labelName}」を追加`;
  return '不明なアクション';
}

function labelStatus(s: string) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

type TriggerType = 'STATUS_CHANGE' | 'PRIORITY_CHANGE' | 'DUE_DATE_APPROACHING';
type ActionType = 'NOTIFY_ASSIGNEES' | 'SET_PRIORITY' | 'MOVE_SECTION' | 'ADD_LABEL';

interface FormState {
  name: string;
  triggerType: TriggerType;
  triggerFrom: string;
  triggerTo: string;
  triggerDaysBefore: string;
  actionType: ActionType;
  actionMessage: string;
  actionPriority: string;
  actionSectionName: string;
  actionLabelName: string;
}

const defaultForm: FormState = {
  name: '',
  triggerType: 'STATUS_CHANGE',
  triggerFrom: '',
  triggerTo: 'DONE',
  triggerDaysBefore: '1',
  actionType: 'NOTIFY_ASSIGNEES',
  actionMessage: '',
  actionPriority: 'P0',
  actionSectionName: '',
  actionLabelName: '',
};

function buildPayload(form: FormState, toast: ReturnType<typeof useToast>['toast']) {
  let trigger: Record<string, unknown>;
  if (form.triggerType === 'STATUS_CHANGE') {
    trigger = { type: 'STATUS_CHANGE', to: form.triggerTo };
    if (form.triggerFrom) trigger.from = form.triggerFrom;
  } else if (form.triggerType === 'PRIORITY_CHANGE') {
    trigger = { type: 'PRIORITY_CHANGE', to: form.triggerTo };
  } else {
    const days = parseInt(form.triggerDaysBefore, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      toast({ variant: 'destructive', title: '日数は1〜365の整数で入力してください' });
      return null;
    }
    trigger = { type: 'DUE_DATE_APPROACHING', daysBefore: days };
  }

  let action: Record<string, unknown>;
  if (form.actionType === 'NOTIFY_ASSIGNEES') {
    action = { type: 'NOTIFY_ASSIGNEES', message: form.actionMessage || undefined };
  } else if (form.actionType === 'SET_PRIORITY') {
    action = { type: 'SET_PRIORITY', priority: form.actionPriority };
  } else if (form.actionType === 'MOVE_SECTION') {
    action = { type: 'MOVE_SECTION', sectionName: form.actionSectionName };
  } else {
    action = { type: 'ADD_LABEL', labelName: form.actionLabelName };
  }

  return { name: form.name, trigger, action };
}

export function AutomationsClient({ project, initialRules, workspaceSlug }: AutomationsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>(initialRules);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);

  const baseUrl = `/api/projects/${project.id}/automations`;

  function openCreateDialog() {
    setEditingRule(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEditDialog(rule: AutomationRule) {
    setEditingRule(rule);
    const t = rule.trigger as Record<string, unknown>;
    const a = rule.action as Record<string, unknown>;

    setForm({
      name: rule.name,
      triggerType: t.type as TriggerType,
      triggerFrom: (t.from as string) ?? '',
      triggerTo: (t.to as string) ?? 'DONE',
      triggerDaysBefore: String(t.daysBefore ?? '1'),
      actionType: a.type as ActionType,
      actionMessage: (a.message as string) ?? '',
      actionPriority: (a.priority as string) ?? 'P0',
      actionSectionName: (a.sectionName as string) ?? '',
      actionLabelName: (a.labelName as string) ?? '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = buildPayload(form, toast);
      if (!payload) return;

      if (editingRule) {
        const res = await fetch(`${baseUrl}/${editingRule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          setDialogOpen(false);
        } else {
          toast({ variant: 'destructive', title: 'ルールの更新に失敗しました' });
        }
      } else {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setRules((prev) => [...prev, created]);
          setDialogOpen(false);
        } else {
          toast({ variant: 'destructive', title: 'ルールの追加に失敗しました' });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: AutomationRule) {
    const res = await fetch(`${baseUrl}/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } else {
      toast({ variant: 'destructive', title: 'ルールの切り替えに失敗しました' });
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    const ruleId = deleteTarget.id;
    setDeleteTarget(null);
    const res = await fetch(`${baseUrl}/${ruleId}`, { method: 'DELETE' });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } else {
      toast({ variant: 'destructive', title: 'ルールの削除に失敗しました' });
    }
  }

  const setF = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <Header title={project.name} workspaceSlug={workspaceSlug} />

      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/${workspaceSlug}/projects/${project.id}`}
            className="flex items-center gap-1 text-sm text-g-text-secondary hover:text-g-text"
          >
            <ArrowLeft className="h-4 w-4" />
            プロジェクトに戻る
          </Link>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#4285F4]" />
            <h2 className="text-xl font-semibold text-g-text">自動化ルール</h2>
          </div>
          <Button onClick={openCreateDialog} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            ルールを追加
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-g-border p-12 text-center">
            <Zap className="mx-auto mb-3 h-10 w-10 text-[#DADCE0]" />
            <p className="text-sm text-g-text-secondary">自動化ルールがまだありません</p>
            <p className="mt-1 text-xs text-g-text-muted">
              ルールを追加して、タスクの更新を自動化しましょう
            </p>
            <Button onClick={openCreateDialog} variant="outline" size="sm" className="mt-4 gap-1">
              <Plus className="h-4 w-4" />
              最初のルールを追加
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-start gap-4 rounded-lg border border-g-border bg-g-bg p-4 shadow-sm"
              >
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={() => handleToggle(rule)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-g-text">{rule.name}</p>
                  <p className="mt-0.5 text-sm text-g-text-secondary">
                    <span className="font-medium text-[#1A73E8]">トリガー: </span>
                    {describeTrigger(rule.trigger)}
                  </p>
                  <p className="text-sm text-g-text-secondary">
                    <span className="font-medium text-[#34A853]">アクション: </span>
                    {describeAction(rule.action)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-g-text-secondary"
                    onClick={() => openEditDialog(rule)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#EA4335]"
                    onClick={() => setDeleteTarget(rule)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 削除確認 AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ルールを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#EA4335] hover:bg-red-600"
              onClick={handleDeleteConfirmed}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'ルールを編集' : 'ルールを追加'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ルール名</Label>
              <Input
                placeholder="例: 完了時に担当者に通知"
                value={form.name}
                onChange={(e) => setF('name', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>トリガー</Label>
              <Select value={form.triggerType} onValueChange={(v) => setF('triggerType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STATUS_CHANGE">ステータス変更時</SelectItem>
                  <SelectItem value="PRIORITY_CHANGE">優先度変更時</SelectItem>
                  <SelectItem value="DUE_DATE_APPROACHING">期限N日前</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.triggerType === 'STATUS_CHANGE' && (
              <div className="ml-4 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-g-text-secondary">変更前（省略可）</Label>
                  <Select value={form.triggerFrom || '_none'} onValueChange={(v) => setF('triggerFrom', v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="すべて" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">すべて</SelectItem>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-g-text-secondary">変更後</Label>
                  <Select value={form.triggerTo} onValueChange={(v) => setF('triggerTo', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {form.triggerType === 'PRIORITY_CHANGE' && (
              <div className="ml-4 space-y-1.5">
                <Label className="text-xs text-g-text-secondary">変更後の優先度</Label>
                <Select value={form.triggerTo} onValueChange={(v) => setF('triggerTo', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.triggerType === 'DUE_DATE_APPROACHING' && (
              <div className="ml-4 space-y-1.5">
                <Label className="text-xs text-g-text-secondary">何日前</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={form.triggerDaysBefore}
                  onChange={(e) => setF('triggerDaysBefore', e.target.value)}
                  className="w-28"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>アクション</Label>
              <Select value={form.actionType} onValueChange={(v) => setF('actionType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTIFY_ASSIGNEES">担当者に通知</SelectItem>
                  <SelectItem value="SET_PRIORITY">優先度を設定</SelectItem>
                  <SelectItem value="MOVE_SECTION">セクションに移動</SelectItem>
                  <SelectItem value="ADD_LABEL">ラベルを追加</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.actionType === 'NOTIFY_ASSIGNEES' && (
              <div className="ml-4 space-y-1.5">
                <Label className="text-xs text-g-text-secondary">通知メッセージ（省略可）</Label>
                <Input
                  placeholder="例: タスクが完了しました"
                  value={form.actionMessage}
                  onChange={(e) => setF('actionMessage', e.target.value)}
                />
              </div>
            )}

            {form.actionType === 'SET_PRIORITY' && (
              <div className="ml-4 space-y-1.5">
                <Label className="text-xs text-g-text-secondary">設定する優先度</Label>
                <Select value={form.actionPriority} onValueChange={(v) => setF('actionPriority', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.actionType === 'MOVE_SECTION' && (
              <div className="ml-4 space-y-1.5">
                <Label className="text-xs text-g-text-secondary">移動先セクション名</Label>
                <Input
                  placeholder="例: 完了"
                  value={form.actionSectionName}
                  onChange={(e) => setF('actionSectionName', e.target.value)}
                />
              </div>
            )}

            {form.actionType === 'ADD_LABEL' && (
              <div className="ml-4 space-y-1.5">
                <Label className="text-xs text-g-text-secondary">追加するラベル名</Label>
                <Input
                  placeholder="例: レビュー済み"
                  value={form.actionLabelName}
                  onChange={(e) => setF('actionLabelName', e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? '保存中...' : editingRule ? '更新' : '追加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
