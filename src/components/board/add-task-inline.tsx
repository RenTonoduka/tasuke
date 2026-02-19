'use client';

import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';

interface AddTaskInlineProps {
  onAdd: (title: string) => void;
}

export function AddTaskInline({ onAdd }: AddTaskInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (trimmed) {
      onAdd(trimmed);
      setTitle('');
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
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[#80868B] hover:bg-[#F1F3F4] hover:text-[#5F6368]"
      >
        <Plus className="h-4 w-4" />
        タスクを追加
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[#4285F4] bg-white p-2">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') setIsEditing(false);
        }}
        onBlur={handleSubmit}
        placeholder="タスク名を入力..."
        className="w-full bg-transparent text-sm text-[#202124] outline-none placeholder:text-[#DADCE0]"
        autoFocus
      />
    </div>
  );
}
