'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';

const colorPresets = [
  '#4285F4', '#EA4335', '#FBBC04', '#34A853',
  '#8E24AA', '#E91E63', '#FF6D00', '#00ACC1',
];

interface ProjectCreateDialogProps {
  workspaceId: string;
  workspaceSlug: string;
}

export function ProjectCreateDialog({ workspaceId, workspaceSlug }: ProjectCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4285F4');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (res.ok) {
        const project = await res.json();
        setOpen(false);
        setName('');
        router.push(`/${workspaceSlug}/projects/${project.id}`);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-[#80868B] hover:text-[#202124]"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>新しいプロジェクト</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="プロジェクト名"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex gap-2">
            {colorPresets.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-transform ${
                  color === c ? 'scale-110 ring-2 ring-offset-2' : ''
                }`}
                style={{ backgroundColor: c, ['--tw-ring-color' as string]: c } as React.CSSProperties}
              />
            ))}
          </div>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="w-full bg-[#4285F4] hover:bg-[#3367D6]"
          >
            作成
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
