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
import { Plus, Layers } from 'lucide-react';
import { TemplateListDialog } from './template-list-dialog';

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
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tab, setTab] = useState<'new' | 'template'>('new');
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

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setTab('new');
      setName('');
      setColor('#4285F4');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
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

          {/* タブ */}
          <div className="flex rounded-md border border-[#E8EAED]">
            <button
              onClick={() => setTab('new')}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                tab === 'new'
                  ? 'bg-[#E8EAED] text-[#202124]'
                  : 'text-[#5F6368] hover:bg-[#F1F3F4]'
              }`}
            >
              新規作成
            </button>
            <button
              onClick={() => { setOpen(false); setTemplateOpen(true); }}
              className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#5F6368] hover:bg-[#F1F3F4]"
            >
              <Layers className="h-3 w-3" />
              テンプレートから
            </button>
          </div>

          {tab === 'new' && (
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
          )}
        </DialogContent>
      </Dialog>

      <TemplateListDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
      />
    </>
  );
}
