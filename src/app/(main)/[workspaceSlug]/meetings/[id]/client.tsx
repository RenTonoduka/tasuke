'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, Check, X, Trash2, ArrowLeft, AlertTriangle, CloudUpload } from 'lucide-react';

type Priority = 'P0' | 'P1' | 'P2' | 'P3';

interface ExtractedTaskRow {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MERGED';
  originalQuote: string;
  confidence: number;
  suggestedTitle: string;
  suggestedDescription: string | null;
  suggestedAssigneeId: string | null;
  suggestedAssigneeName: string | null;
  suggestedProjectId: string | null;
  suggestedDueDate: string | null;
  suggestedPriority: Priority;
  finalTitle: string | null;
  finalDescription: string | null;
  finalAssigneeId: string | null;
  finalProjectId: string | null;
  finalSectionId: string | null;
  finalDueDate: string | null;
  finalPriority: Priority | null;
  createdTaskId: string | null;
}

interface MeetingDetail {
  id: string;
  workspaceId: string;
  title: string;
  status: 'EXTRACTING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FAILED';
  meetingDate: string | null;
  transcript: string;
  approvedAt: string | null;
  failureReason: string | null;
  extractedTasks: ExtractedTaskRow[];
}

interface ProjectLite {
  id: string;
  name: string;
  color: string;
  sections: { id: string; name: string }[];
}
interface MemberLite {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface DetailResponse {
  meeting: MeetingDetail;
  projects: ProjectLite[];
  members: MemberLite[];
}

interface RowEdits {
  finalTitle?: string;
  finalAssigneeId?: string | null;
  finalProjectId?: string | null;
  finalSectionId?: string | null;
  finalDueDate?: string | null;
  finalPriority?: Priority;
}

export function MeetingDetailClient({ meetingId, workspaceSlug }: { meetingId: string; workspaceSlug: string }) {
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, RowEdits>>({});
  const [decisions, setDecisions] = useState<Record<string, 'approve' | 'reject'>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/meetings/${meetingId}`);
      if (!res.ok) {
        toast({ title: '読み込みに失敗しました', variant: 'destructive' });
        return;
      }
      const json = (await res.json()) as DetailResponse;
      if (!cancelled) {
        setData(json);
        // デフォルト: PENDINGの全タスクを承認候補にチェック
        const init: Record<string, 'approve' | 'reject'> = {};
        for (const et of json.meeting.extractedTasks) {
          if (et.status === 'PENDING') init[et.id] = 'approve';
        }
        setDecisions(init);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  const projects = useMemo(() => data?.projects ?? [], [data]);
  const members = useMemo(() => data?.members ?? [], [data]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  function getEdit(et: ExtractedTaskRow, key: keyof RowEdits): unknown {
    const e = edits[et.id];
    if (e && key in e) return e[key];
    if (key === 'finalTitle') return et.finalTitle ?? et.suggestedTitle;
    if (key === 'finalAssigneeId') return et.finalAssigneeId ?? et.suggestedAssigneeId;
    if (key === 'finalProjectId') return et.finalProjectId ?? et.suggestedProjectId;
    if (key === 'finalSectionId') return et.finalSectionId;
    if (key === 'finalDueDate') {
      const v = et.finalDueDate ?? et.suggestedDueDate;
      return v ? v.slice(0, 10) : '';
    }
    if (key === 'finalPriority') return et.finalPriority ?? et.suggestedPriority;
    return undefined;
  }

  // ── auto-save (debounced PATCH) ──
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  function persistEdit(etId: string, partial: RowEdits) {
    setSaveStatus('saving');
    const body: Record<string, string | null | undefined> = {
      finalTitle: partial.finalTitle,
      finalAssigneeId: partial.finalAssigneeId,
      finalProjectId: partial.finalProjectId,
      finalSectionId: partial.finalSectionId,
      finalDueDate: partial.finalDueDate ? new Date(partial.finalDueDate).toISOString() : partial.finalDueDate,
      finalPriority: partial.finalPriority,
    };
    fetch(`/api/meetings/${meetingId}/extracted-tasks/${etId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => {
        if (!r.ok) {
          setSaveStatus('error');
        } else {
          setSaveStatus('saved');
          window.setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
        }
      })
      .catch(() => setSaveStatus('error'));
  }

  function setEdit(etId: string, key: keyof RowEdits, value: string | null) {
    setEdits((prev) => {
      const next = { ...prev, [etId]: { ...prev[etId], [key]: value } };
      // debounce per-row PATCH
      if (saveTimers.current[etId]) clearTimeout(saveTimers.current[etId]);
      saveTimers.current[etId] = setTimeout(() => {
        persistEdit(etId, next[etId]);
      }, 800);
      return next;
    });
  }

  function setDecision(etId: string, action: 'approve' | 'reject' | null) {
    setDecisions((prev) => {
      const next = { ...prev };
      if (action === null) delete next[etId];
      else next[etId] = action;
      return next;
    });
  }

  const pending = data?.meeting.extractedTasks.filter((et) => et.status === 'PENDING') ?? [];
  const approveCount = Object.values(decisions).filter((d) => d === 'approve').length;
  const rejectCount = Object.values(decisions).filter((d) => d === 'reject').length;

  async function submitBulk() {
    if (!data) return;
    if (approveCount === 0 && rejectCount === 0) {
      toast({ title: '承認/却下するタスクを選んでください', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const items = Object.entries(decisions).map(([etId, action]) => {
        const e = edits[etId] ?? {};
        const due = e.finalDueDate;
        return {
          extractedTaskId: etId,
          action,
          edits: {
            finalTitle: e.finalTitle,
            finalAssigneeId: e.finalAssigneeId,
            finalProjectId: e.finalProjectId,
            finalSectionId: e.finalSectionId,
            finalDueDate: due ? new Date(due).toISOString() : undefined,
            finalPriority: e.finalPriority,
          },
        };
      });

      const res = await fetch(`/api/meetings/${meetingId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: '送信に失敗しました', description: json.error ?? '', variant: 'destructive' });
        return;
      }
      const summary: { approved: unknown[]; rejected: unknown[]; skipped: { reason: string }[] } = json;
      toast({
        title: `${summary.approved.length}件作成 / ${summary.rejected.length}件却下${summary.skipped.length > 0 ? ` / ${summary.skipped.length}件スキップ` : ''}`,
      });
      router.push(`/${workspaceSlug}/meetings`);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteMeeting() {
    if (!confirm('この議事録レコードを削除します（承認済みタスクは残ります）')) return;
    const res = await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast({ title: '削除に失敗しました', variant: 'destructive' });
      return;
    }
    router.push(`/${workspaceSlug}/meetings`);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-g-text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        読み込み中...
      </div>
    );
  }
  if (!data) return null;

  const m = data.meeting;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/${workspaceSlug}/meetings`}
            className="inline-flex items-center gap-1 text-sm text-g-text-secondary hover:text-g-text"
          >
            <ArrowLeft className="h-4 w-4" />
            一覧に戻る
          </Link>
          <button
            onClick={deleteMeeting}
            className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" />
            この議事録を削除
          </button>
        </div>

        <div className="rounded-lg border border-g-border bg-g-surface p-4">
          <h1 className="text-lg font-semibold">{m.title}</h1>
          <p className="mt-1 text-xs text-g-text-muted">
            {m.meetingDate ? new Date(m.meetingDate).toLocaleDateString('ja-JP') : '日付不明'} · 抽出
            {m.extractedTasks.length}件 · 状態: {m.status}
          </p>
          {m.failureReason && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {m.failureReason}
            </p>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-g-border bg-g-surface py-10 text-center text-sm text-g-text-muted">
            レビュー待ちのタスクはありません
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-g-border">
              <table className="w-full text-sm">
                <thead className="border-b border-g-border bg-g-surface text-left text-xs text-g-text-muted">
                  <tr>
                    <th className="w-24 px-3 py-2 font-medium">判定</th>
                    <th className="px-3 py-2 font-medium">タイトル / 元発言</th>
                    <th className="w-44 px-3 py-2 font-medium">担当</th>
                    <th className="w-44 px-3 py-2 font-medium">プロジェクト/セクション</th>
                    <th className="w-32 px-3 py-2 font-medium">期日</th>
                    <th className="w-20 px-3 py-2 font-medium">優先度</th>
                    <th className="w-16 px-3 py-2 font-medium">信頼度</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((et) => {
                    const decision = decisions[et.id];
                    const projectId = (getEdit(et, 'finalProjectId') as string | null) ?? null;
                    const project = projectId ? projectById.get(projectId) : null;
                    return (
                      <tr key={et.id} className="border-b border-g-border last:border-b-0 align-top">
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => setDecision(et.id, decision === 'approve' ? null : 'approve')}
                              className={`inline-flex items-center justify-center gap-1 rounded border px-2 py-1 text-xs ${
                                decision === 'approve'
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-200'
                                  : 'border-g-border text-g-text-secondary hover:bg-g-surface'
                              }`}
                            >
                              <Check className="h-3 w-3" />
                              承認
                            </button>
                            <button
                              onClick={() => setDecision(et.id, decision === 'reject' ? null : 'reject')}
                              className={`inline-flex items-center justify-center gap-1 rounded border px-2 py-1 text-xs ${
                                decision === 'reject'
                                  ? 'border-red-500 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-200'
                                  : 'border-g-border text-g-text-secondary hover:bg-g-surface'
                              }`}
                            >
                              <X className="h-3 w-3" />
                              却下
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={(getEdit(et, 'finalTitle') as string) ?? ''}
                            onChange={(e) => setEdit(et.id, 'finalTitle', e.target.value)}
                            className="w-full rounded border border-g-border bg-g-bg px-2 py-1 text-sm"
                          />
                          <p className="mt-1 text-xs italic text-g-text-muted">「{et.originalQuote}」</p>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={(getEdit(et, 'finalAssigneeId') as string | null) ?? ''}
                            onChange={(e) => setEdit(et.id, 'finalAssigneeId', e.target.value || null)}
                            className="w-full rounded border border-g-border bg-g-bg px-2 py-1 text-xs"
                          >
                            <option value="">— 未指定 —</option>
                            {members.map((mb) => (
                              <option key={mb.id} value={mb.id}>
                                {mb.name ?? mb.email}
                              </option>
                            ))}
                          </select>
                          {!getEdit(et, 'finalAssigneeId') && et.suggestedAssigneeName && (
                            <p className="mt-0.5 text-xs text-g-text-muted">候補: {et.suggestedAssigneeName}</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={projectId ?? ''}
                            onChange={(e) => {
                              setEdit(et.id, 'finalProjectId', e.target.value || null);
                              setEdit(et.id, 'finalSectionId', null);
                            }}
                            className="w-full rounded border border-g-border bg-g-bg px-2 py-1 text-xs"
                          >
                            <option value="">— プロジェクト選択 —</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          {project && project.sections.length > 0 && (
                            <select
                              value={(getEdit(et, 'finalSectionId') as string | null) ?? ''}
                              onChange={(e) => setEdit(et.id, 'finalSectionId', e.target.value || null)}
                              className="mt-1 w-full rounded border border-g-border bg-g-bg px-2 py-1 text-xs"
                            >
                              <option value="">— セクション(任意) —</option>
                              {project.sections.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={(getEdit(et, 'finalDueDate') as string) ?? ''}
                            onChange={(e) => setEdit(et.id, 'finalDueDate', e.target.value || null)}
                            className="w-full rounded border border-g-border bg-g-bg px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={(getEdit(et, 'finalPriority') as Priority) ?? 'P3'}
                            onChange={(e) => setEdit(et.id, 'finalPriority', e.target.value as Priority)}
                            className="w-full rounded border border-g-border bg-g-bg px-2 py-1 text-xs"
                          >
                            {(['P0', 'P1', 'P2', 'P3'] as Priority[]).map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-g-text-muted">{Math.round(et.confidence * 100)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sticky bottom-0 -mx-6 flex items-center justify-between border-t border-g-border bg-g-bg px-6 py-3">
              <div className="flex items-center gap-3 text-sm text-g-text-secondary">
                <span>{approveCount}件承認 / {rejectCount}件却下</span>
                {saveStatus === 'saving' && (
                  <span className="inline-flex items-center gap-1 text-xs text-g-text-muted">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    保存中...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CloudUpload className="h-3 w-3" />
                    編集を保存しました
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    保存失敗
                  </span>
                )}
              </div>
              <Button onClick={submitBulk} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    処理中...
                  </>
                ) : (
                  '一括実行'
                )}
              </Button>
            </div>
          </>
        )}

        {/* 完了済みのタスク（参考表示） */}
        {data.meeting.extractedTasks.some((et) => et.status !== 'PENDING') && (
          <details className="text-sm">
            <summary className="cursor-pointer text-g-text-secondary">完了済みのタスク</summary>
            <ul className="mt-2 space-y-1">
              {data.meeting.extractedTasks
                .filter((et) => et.status !== 'PENDING')
                .map((et) => (
                  <li key={et.id} className="text-xs text-g-text-muted">
                    [{et.status}] {et.finalTitle ?? et.suggestedTitle}
                    {et.createdTaskId && (
                      <span className="ml-1 text-emerald-700 dark:text-emerald-300">→ Task作成済み</span>
                    )}
                  </li>
                ))}
            </ul>
          </details>
        )}

        <details className="rounded border border-g-border bg-g-surface p-3 text-xs">
          <summary className="cursor-pointer text-g-text-secondary">議事録の元テキスト</summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
            {m.transcript}
          </pre>
        </details>
      </div>
    </div>
  );
}
