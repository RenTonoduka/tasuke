'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface SaveTemplateButtonProps {
  projectId: string;
  projectName: string;
}

export function SaveTemplateButton({ projectId, projectName }: SaveTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleOpen = () => {
    setTemplateName(projectName);
    setDescription('');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!templateName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/save-as-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '保存に失敗しました');
      }
      setOpen(false);
      toast({
        title: 'テンプレートとして保存しました',
        description: `「${templateName}」をテンプレートに保存しました`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '保存エラー',
        description: err instanceof Error ? err.message : '保存に失敗しました',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs text-[#5F6368] hover:bg-[#F1F3F4]"
        onClick={handleOpen}
      >
        <Copy className="h-3.5 w-3.5" />
        テンプレートとして保存
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>テンプレートとして保存</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-name" className="text-sm">
                テンプレート名
              </Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="テンプレート名"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-desc" className="text-sm">
                説明（任意）
              </Label>
              <Input
                id="template-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="テンプレートの説明"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={!templateName.trim() || loading}
              className="w-full bg-[#4285F4] hover:bg-[#3367D6]"
            >
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
