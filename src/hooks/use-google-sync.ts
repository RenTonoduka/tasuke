import { useState } from 'react';

export function useGoogleSync(taskId: string, endpoint: string, onSync: () => void) {
  const [syncing, setSyncing] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sync = async () => {
    setSyncing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/${endpoint}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error ?? '同期に失敗しました');
        return;
      }
      onSync();
    } catch {
      setErrorMessage('ネットワークエラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  const unlink = async () => {
    setUnlinking(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/${endpoint}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error ?? '連携解除に失敗しました');
        return;
      }
      onSync();
    } catch {
      setErrorMessage('ネットワークエラーが発生しました');
    } finally {
      setUnlinking(false);
    }
  };

  return { syncing, unlinking, errorMessage, sync, unlink, setErrorMessage };
}
