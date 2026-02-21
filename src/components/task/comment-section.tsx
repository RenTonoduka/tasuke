'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Pencil, Trash2, Check, X } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface CommentSectionProps {
  taskId: string;
  comments: Comment[];
  onCommentAdded: () => void;
}

export function CommentSection({ taskId, comments, onCommentAdded }: CommentSectionProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const currentUserId = (session?.user as { id?: string })?.id;

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        setContent('');
        onCommentAdded();
      }
    } finally {
      setSubmitting(false);
    }
  }, [content, taskId, submitting, onCommentAdded]);

  const handleEdit = async (commentId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        setEditingId(null);
        onCommentAdded();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) onCommentAdded();
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="border-t border-g-border px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-g-text-muted" />
        <label className="text-xs font-medium text-g-text-secondary">
          コメント {comments.length > 0 && `(${comments.length})`}
        </label>
      </div>

      {/* コメント一覧 */}
      {comments.length > 0 && (
        <div className="mb-4 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="group flex gap-2.5">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={c.user.image ?? ''} />
                <AvatarFallback className="bg-[#4285F4] text-xs text-white">
                  {(c.user.name ?? c.user.email).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-g-text">
                    {c.user.name ?? c.user.email}
                  </span>
                  <span className="text-xs text-g-text-muted">{formatDate(c.createdAt)}</span>
                  {currentUserId === c.user.id && editingId !== c.id && (
                    <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => { setEditingId(c.id); setEditContent(c.content); }}
                        className="rounded p-0.5 text-g-text-muted hover:text-g-text"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="rounded p-0.5 text-g-text-muted hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
                {editingId === c.id ? (
                  <div className="mt-1 space-y-1.5">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleEdit(c.id);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="min-h-[56px] resize-none border-g-border text-sm focus:border-[#4285F4]"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleEdit(c.id)}
                        className="flex items-center gap-1 rounded bg-[#4285F4] px-2 py-0.5 text-xs text-white hover:bg-[#3367D6]"
                      >
                        <Check className="h-3 w-3" /> 保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 rounded border border-g-border px-2 py-0.5 text-xs text-g-text-secondary hover:bg-g-surface-hover"
                      >
                        <X className="h-3 w-3" /> キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-g-text">
                    {c.content}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 投稿フォーム */}
      <div className="flex gap-2.5">
        <Avatar className="h-7 w-7 flex-shrink-0">
          <AvatarImage src={session?.user?.image ?? ''} />
          <AvatarFallback className="bg-[#4285F4] text-xs text-white">
            {(session?.user?.name ?? session?.user?.email ?? 'U').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="コメントを追加... (@名前 でメンション、Cmd+Enter で送信)"
            className="min-h-[72px] resize-none border-g-border text-sm focus:border-[#4285F4]"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!content.trim() || submitting}
              onClick={handleSubmit}
              className="h-7 gap-1.5 bg-[#4285F4] text-xs hover:bg-[#3367D6]"
            >
              <Send className="h-3 w-3" />
              {submitting ? '送信中...' : '送信'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
