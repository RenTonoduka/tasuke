import { useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

interface Subtask {
  id: string;
  title: string;
  status: string;
}

export function useSubtaskExpand() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  // ステールクロージャ回避用
  const subtasksRef = useRef(subtasks);
  subtasksRef.current = subtasks;

  const toggle = useCallback(async (taskId: string) => {
    setExpanded((prev) => {
      const isOpen = prev[taskId];
      if (!isOpen && !subtasksRef.current[taskId]) {
        // 初回展開時にサブタスク取得（非同期）
        setLoading((p) => ({ ...p, [taskId]: true }));
        fetch(`/api/tasks/${taskId}/subtasks`)
          .then((res) => (res.ok ? res.json() : Promise.reject(res)))
          .then((data: Subtask[]) => {
            setSubtasks((p) => ({ ...p, [taskId]: data }));
          })
          .catch(() => {
            toast({ title: 'サブタスクの取得に失敗', variant: 'destructive' });
          })
          .finally(() => {
            setLoading((p) => ({ ...p, [taskId]: false }));
          });
      }
      return { ...prev, [taskId]: !isOpen };
    });
  }, []);

  const toggleStatus = useCallback(async (parentId: string, subtaskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';

    setSubtasks((prev) => ({
      ...prev,
      [parentId]: (prev[parentId] ?? []).map((s) =>
        s.id === subtaskId ? { ...s, status: newStatus } : s
      ),
    }));

    try {
      const res = await fetch(`/api/tasks/${subtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSubtasks((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] ?? []).map((s) =>
          s.id === subtaskId ? { ...s, status: currentStatus } : s
        ),
      }));
      toast({ title: 'ステータス更新に失敗', variant: 'destructive' });
    }
  }, []);

  const deleteSubtask = useCallback(async (parentId: string, subtaskId: string) => {
    // setState関数形式で最新stateから操作（ステールクロージャ回避）
    let snapshot: Subtask[] = [];
    setSubtasks((prev) => {
      snapshot = prev[parentId] ?? [];
      return {
        ...prev,
        [parentId]: snapshot.filter((s) => s.id !== subtaskId),
      };
    });

    try {
      const res = await fetch(`/api/tasks/${subtaskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setSubtasks((prev) => ({ ...prev, [parentId]: snapshot }));
      toast({ title: 'サブタスクの削除に失敗', variant: 'destructive' });
    }
  }, []);

  return { expanded, subtasks, loading, toggle, toggleStatus, deleteSubtask };
}
