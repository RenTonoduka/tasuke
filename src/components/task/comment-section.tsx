'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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

interface MentionMember {
  id: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface CommentSectionProps {
  taskId: string;
  comments: Comment[];
  onCommentAdded: () => void;
  workspaceId?: string;
}

export function CommentSection({ taskId, comments, onCommentAdded, workspaceId }: CommentSectionProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Mention autocomplete state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIdx, setMentionIdx] = useState(0);
  const [members, setMembers] = useState<MentionMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(-1);

  const currentUserId = (session?.user as { id?: string })?.id;

  // Fetch members on first @ trigger
  useEffect(() => {
    if (!mentionOpen || membersLoaded || !workspaceId) return;
    (async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/members`);
        if (res.ok) {
          setMembers(await res.json());
          setMembersLoaded(true);
        }
      } catch {}
    })();
  }, [mentionOpen, membersLoaded, workspaceId]);

  const filteredMembers = members.filter((m) => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    return (
      (m.user.name?.toLowerCase().includes(q)) ||
      m.user.email.toLowerCase().includes(q)
    );
  }).slice(0, 6);

  const insertMention = useCallback((member: MentionMember) => {
    const name = member.user.name ?? member.user.email.split('@')[0];
    const start = mentionStartRef.current;
    const before = content.slice(0, start);
    const afterCursor = content.slice(textareaRef.current?.selectionStart ?? start);
    const newContent = `${before}@${name} ${afterCursor}`;
    setContent(newContent);
    setMentionOpen(false);
    setMentionQuery('');
    // Focus back
    setTimeout(() => {
      const pos = before.length + name.length + 2; // @name + space
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }, [content]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setContent(val);

    // Detect @ mention trigger
    if (pos > 0 && val[pos - 1] === '@' && (pos === 1 || val[pos - 2] === ' ' || val[pos - 2] === '\n')) {
      mentionStartRef.current = pos - 1;
      setMentionOpen(true);
      setMentionQuery('');
      setMentionIdx(0);
      return;
    }

    if (mentionOpen) {
      const start = mentionStartRef.current;
      if (pos <= start) {
        setMentionOpen(false);
        return;
      }
      const query = val.slice(start + 1, pos);
      if (query.includes(' ') || query.includes('\n')) {
        setMentionOpen(false);
        return;
      }
      setMentionQuery(query);
      setMentionIdx(0);
    }
  }, [mentionOpen]);

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
    if (!window.confirm('このコメントを削除しますか？')) return;
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
    // Mention navigation
    if (mentionOpen && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[mentionIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }

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
        <div className="relative flex flex-1 flex-col gap-2">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setMentionOpen(false), 200)}
            placeholder="コメントを追加... (@名前 でメンション、Cmd+Enter で送信)"
            className="min-h-[72px] resize-none border-g-border text-sm focus:border-[#4285F4]"
          />

          {/* Mention autocomplete dropdown */}
          {mentionOpen && filteredMembers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-64 rounded-md border border-g-border bg-g-bg shadow-lg z-50">
              {filteredMembers.map((m, i) => (
                <button
                  key={m.user.id}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-g-surface-hover ${
                    i === mentionIdx ? 'bg-g-surface-hover' : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(m);
                  }}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={m.user.image ?? ''} />
                    <AvatarFallback className="bg-[#4285F4] text-[8px] text-white">
                      {(m.user.name ?? m.user.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-g-text">{m.user.name ?? m.user.email}</span>
                </button>
              ))}
            </div>
          )}

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
