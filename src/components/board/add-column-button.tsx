'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface AddColumnButtonProps {
  onAdd: (name: string) => void;
}

export function AddColumnButton({ onAdd }: AddColumnButtonProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed) {
      onAdd(trimmed);
    }
    setName('');
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex h-10 w-[280px] flex-shrink-0 items-center justify-center gap-1 rounded-lg border border-dashed border-g-border text-sm text-g-text-muted transition-colors hover:border-[#4285F4] hover:text-[#4285F4]"
      >
        <Plus className="h-4 w-4" />
        カラムを追加
      </button>
    );
  }

  return (
    <div className="flex h-fit w-[280px] flex-shrink-0 flex-col gap-2 rounded-lg bg-g-surface p-3">
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setName('');
            setEditing(false);
          }
        }}
        placeholder="カラム名"
        maxLength={50}
        className="rounded border border-[#4285F4] bg-transparent px-2 py-1 text-sm text-g-text outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={commit}
          className="rounded bg-[#4285F4] px-3 py-1 text-xs font-medium text-white hover:bg-[#3367D6]"
        >
          追加
        </button>
        <button
          type="button"
          onClick={() => {
            setName('');
            setEditing(false);
          }}
          className="rounded px-2 py-1 text-xs text-g-text-muted hover:bg-g-border"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
