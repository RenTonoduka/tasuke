'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AddTaskInlineProps {
  onAdd: (title: string) => void;
  listenNewTask?: boolean;
}

export function AddTaskInline({ onAdd, listenNewTask }: AddTaskInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listenNewTask) return;
    const handler = () => {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener('tasuke:new-task', handler);
    return () => window.removeEventListener('tasuke:new-task', handler);
  }, [listenNewTask]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (trimmed) {
      onAdd(trimmed);
      setTitle('');
      toast({
        title: '担当者が未設定です',
        description: 'タスクをクリックして担当者を設定してください',
      });
    }
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => {
          setIsEditing(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-g-text-muted hover:bg-g-surface-hover hover:text-g-text-secondary"
      >
        <Plus className="h-4 w-4" />
        タスクを追加
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[#4285F4] bg-g-bg p-2">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') setIsEditing(false);
        }}
        onBlur={handleSubmit}
        placeholder="タスク名を入力..."
        className="w-full bg-transparent text-sm text-g-text outline-none placeholder:text-[#DADCE0]"
        autoFocus
      />
    </div>
  );
}
