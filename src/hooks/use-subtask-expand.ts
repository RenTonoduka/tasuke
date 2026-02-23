import { useState, useCallback } from 'react';

interface Subtask {
  id: string;
  title: string;
  status: string;
}

export function useSubtaskExpand() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const toggle = useCallback(async (taskId: string) => {
    const isOpen = expanded[taskId];
    setExpanded((prev) => ({ ...prev, [taskId]: !isOpen }));

    // 初回展開時にサブタスク取得
    if (!isOpen && !subtasks[taskId]) {
      setLoading((prev) => ({ ...prev, [taskId]: true }));
      try {
        const res = await fetch(`/api/tasks/${taskId}/subtasks`);
        if (res.ok) {
          const data: Subtask[] = await res.json();
          setSubtasks((prev) => ({ ...prev, [taskId]: data }));
        }
      } finally {
        setLoading((prev) => ({ ...prev, [taskId]: false }));
      }
    }
  }, [expanded, subtasks]);

  const toggleStatus = useCallback(async (parentId: string, subtaskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';

    // 楽観的更新
    setSubtasks((prev) => ({
      ...prev,
      [parentId]: (prev[parentId] ?? []).map((s) =>
        s.id === subtaskId ? { ...s, status: newStatus } : s
      ),
    }));

    try {
      await fetch(`/api/tasks/${subtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // ロールバック
      setSubtasks((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] ?? []).map((s) =>
          s.id === subtaskId ? { ...s, status: currentStatus } : s
        ),
      }));
    }
  }, []);

  const deleteSubtask = useCallback(async (parentId: string, subtaskId: string) => {
    const prev = subtasks[parentId] ?? [];
    setSubtasks((p) => ({
      ...p,
      [parentId]: prev.filter((s) => s.id !== subtaskId),
    }));

    try {
      await fetch(`/api/tasks/${subtaskId}`, { method: 'DELETE' });
    } catch {
      setSubtasks((p) => ({ ...p, [parentId]: prev }));
    }
  }, [subtasks]);

  return { expanded, subtasks, loading, toggle, toggleStatus, deleteSubtask };
}
