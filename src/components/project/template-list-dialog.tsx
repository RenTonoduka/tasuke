'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Trash2, FolderPlus, Layers } from 'lucide-react';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  _count: { taskTemplates: number };
}

interface TemplateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceSlug: string;
}

export function TemplateListDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceSlug,
}: TemplateListDialogProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectTemplate | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  const handleSelectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setProjectName(template.name);
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !projectName.trim()) return;
    setCreating(selectedTemplate.id);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/projects/from-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id, name: projectName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '作成に失敗しました');
      }
      const project = await res.json();
      onOpenChange(false);
      setSelectedTemplate(null);
      setProjectName('');
      router.push(`/${workspaceSlug}/projects/${project.id}`);
      router.refresh();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'エラー',
        description: err instanceof Error ? err.message : '作成に失敗しました',
      });
    } finally {
      setCreating(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const template = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/templates/${template.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '削除に失敗しました');
      }
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      if (selectedTemplate?.id === template.id) setSelectedTemplate(null);
      toast({ title: 'テンプレートを削除しました' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '削除エラー',
        description: err instanceof Error ? err.message : '削除に失敗しました',
      });
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelectedTemplate(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              プロジェクトテンプレート
            </DialogTitle>
          </DialogHeader>

          {selectedTemplate ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-g-text-secondary">
                「{selectedTemplate.name}」からプロジェクトを作成します
              </p>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="プロジェクト名"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedTemplate(null)}
                >
                  戻る
                </Button>
                <Button
                  className="flex-1 bg-[#4285F4] hover:bg-[#3367D6]"
                  onClick={handleCreate}
                  disabled={!projectName.trim() || creating === selectedTemplate.id}
                >
                  {creating === selectedTemplate.id ? '作成中...' : '作成'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-2">
              {loading ? (
                <p className="py-8 text-center text-sm text-g-text-muted">読み込み中...</p>
              ) : templates.length === 0 ? (
                <p className="py-8 text-center text-sm text-g-text-muted">
                  テンプレートがありません。<br />
                  プロジェクトを「テンプレートとして保存」してください。
                </p>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center gap-3 rounded-lg border border-g-border p-3 hover:bg-g-surface"
                      >
                        <div
                          className="h-8 w-8 flex-shrink-0 rounded-md"
                          style={{ backgroundColor: template.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-g-text">
                            {template.name}
                          </p>
                          <p className="text-xs text-g-text-muted">
                            タスク {template._count.taskTemplates}件 ・ {formatDate(template.createdAt)}
                          </p>
                          {template.description && (
                            <p className="mt-0.5 truncate text-xs text-g-text-secondary">
                              {template.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-xs text-[#4285F4] hover:bg-blue-50"
                            onClick={() => handleSelectTemplate(template)}
                          >
                            <FolderPlus className="h-3.5 w-3.5" />
                            作成
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-g-text-muted hover:bg-red-50 hover:text-red-500"
                            onClick={() => setDeleteTarget(template)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 削除確認 AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テンプレートを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#EA4335] hover:bg-red-600"
              onClick={handleDeleteConfirmed}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
