'use client';

import { useState, useCallback } from 'react';
import { Check, RotateCcw, X, Send, Inbox, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownView } from '@/components/ui/markdown-view';
import { toast } from '@/hooks/use-toast';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import { cn } from '@/lib/utils';

interface WfTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  assignmentState: string | null;
  project: { id: string; name: string; color: string } | null;
  requester: { id: string; name: string | null; image: string | null } | null;
  assignees: { user: { id: string; name: string | null; image: string | null } }[];
  comments: {
    id: string;
    content: string;
    createdAt: string;
    user: { id: string; name: string | null; image: string | null };
  }[];
}

interface Props {
  initial: { toApprove: WfTask[]; toAccept: WfTask[] };
  workspaceId: string;
  workspaceSlug: string;
}

const STATE_LABEL: Record<string, string> = {
  PENDING_ACCEPT: '受諾待ち',
  SENT_BACK: '差し戻し',
  SUBMITTED: '承認待ち',
  RETURNED: '要相談',
};

export function ApprovalsClient({ initial, workspaceId }: Props) {
  const [tab, setTab] = useState<'approve' | 'accept'>('approve');
  const [data, setData] = useState(initial);
  const [commentFor, setCommentFor] = useState<{ taskId: string; action: 'decline' | 'send_back' | 'return' } | null>(null);
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openPanel = useTaskPanelStore((s) => s.open);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/approvals?workspaceId=${workspaceId}`);
    if (res.ok) {
      const json = await res.json();
      setData(json.data ?? json);
    }
  }, [workspaceId]);

  const act = useCallback(
    async (taskId: string, action: string, body?: Record<string, unknown>) => {
      const res = await fetch(`/api/tasks/${taskId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({ title: '操作に失敗', description: j.error, variant: 'destructive' });
        return;
      }
      toast({ title: '更新しました' });
      setCommentFor(null);
      setComment('');
      await refetch();
    },
    [refetch],
  );

  const submitComment = useCallback(() => {
    if (!commentFor) return;
    if (!comment.trim()) {
      toast({ title: 'コメントは必須です', variant: 'destructive' });
      return;
    }
    act(commentFor.taskId, commentFor.action, { comment });
  }, [commentFor, comment, act]);

  const list = tab === 'approve' ? data.toApprove : data.toAccept;

  return (
    <div>
      {/* タブ */}
      <div className="mb-4 flex gap-1 border-b border-g-border">
        <TabButton active={tab === 'approve'} onClick={() => setTab('approve')} count={data.toApprove.length}>
          承認する番
        </TabButton>
        <TabButton active={tab === 'accept'} onClick={() => setTab('accept')} count={data.toAccept.length}>
          受諾・対応する番
        </TabButton>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-g-text-muted">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">ここに表示する項目はありません</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((t) => (
            <li key={t.id} className="rounded-lg border border-g-border bg-g-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleExpand(t.id)}
                  className="mt-0.5 rounded p-0.5 text-g-text-secondary hover:bg-g-surface-hover"
                  aria-label="詳細を表示"
                >
                  {expanded.has(t.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <button onClick={() => openPanel(t.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    {t.assignmentState && STATE_LABEL[t.assignmentState] && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          t.assignmentState === 'SENT_BACK'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                            : t.assignmentState === 'RETURNED'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                        )}
                      >
                        {STATE_LABEL[t.assignmentState]}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-g-text">{t.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-g-text-secondary">
                    {t.project && <span>{t.project.name}</span>}
                    {t.dueDate && (
                      <span>期日 {new Date(t.dueDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</span>
                    )}
                    {tab === 'approve' && t.assignees[0]?.user && (
                      <span>担当: {t.assignees[0].user.name ?? '—'}</span>
                    )}
                    {tab === 'accept' && t.requester && <span>依頼: {t.requester.name ?? '—'}</span>}
                  </div>
                </button>

                {/* アクションボタン */}
                <div className="flex shrink-0 gap-1">
                  {tab === 'approve' ? (
                    t.assignmentState === 'RETURNED' ? (
                      <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => act(t.id, 'resend')}>
                        <Send className="h-3.5 w-3.5" /> 再依頼
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => act(t.id, 'approve')}>
                          <Check className="h-3.5 w-3.5" /> 承認
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => setCommentFor({ taskId: t.id, action: 'send_back' })}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> 差し戻し
                        </Button>
                      </>
                    )
                  ) : t.assignmentState === 'PENDING_ACCEPT' ? (
                    <>
                      <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => act(t.id, 'accept')}>
                        <Check className="h-3.5 w-3.5" /> 受諾
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setCommentFor({ taskId: t.id, action: 'return' })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> 差し戻し
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setCommentFor({ taskId: t.id, action: 'decline' })}
                      >
                        <X className="h-3.5 w-3.5" /> 辞退
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => act(t.id, 'submit')}>
                      <Send className="h-3.5 w-3.5" /> 完了報告
                    </Button>
                  )}
                </div>
              </div>

              {/* コメント必須アクションの入力欄 */}
              {commentFor?.taskId === t.id && (
                <div className="mt-2 border-t border-g-border pt-2">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      commentFor.action === 'decline'
                        ? '辞退理由（必須）'
                        : commentFor.action === 'return'
                          ? '差し戻し理由・希望条件（必須）'
                          : '差し戻し理由（必須）'
                    }
                    className="min-h-[60px] resize-none border-g-border text-sm"
                    autoFocus
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        setCommentFor(null);
                        setComment('');
                      }}
                    >
                      キャンセル
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={submitComment}>
                      送信
                    </Button>
                  </div>
                </div>
              )}

              {/* 展開: 依頼内容の詳細（説明＋直近コメント） */}
              {expanded.has(t.id) && (
                <div className="mt-2 space-y-3 border-t border-g-border pt-2 pl-6">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase text-g-text-muted">説明</div>
                    {t.description ? (
                      <MarkdownView className="text-sm">{t.description}</MarkdownView>
                    ) : (
                      <p className="text-xs text-g-text-muted">説明は未入力です</p>
                    )}
                  </div>
                  {t.comments.length > 0 && (
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase text-g-text-muted">
                        最近のコメント
                      </div>
                      <ul className="space-y-1.5">
                        {[...t.comments].reverse().map((c) => (
                          <li key={c.id} className="rounded border border-g-border bg-g-bg px-2 py-1.5">
                            <div className="flex items-center gap-2 text-[10px] text-g-text-muted">
                              <span className="font-medium text-g-text-secondary">{c.user.name ?? '—'}</span>
                              <span>{new Date(c.createdAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="whitespace-pre-wrap break-words text-xs text-g-text">{c.content}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium',
        active
          ? 'border-blue-500 text-g-text'
          : 'border-transparent text-g-text-secondary hover:text-g-text',
      )}
    >
      {children}
      {count > 0 && (
        <span className="rounded-full bg-g-border px-1.5 text-[10px] text-g-text-secondary">{count}</span>
      )}
    </button>
  );
}
