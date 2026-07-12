import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeyRoots } from '@/lib/queryKeys';

/**
 * Explicit tab-visibility handling for live data. The poll interval is already
 * paused while the tab is hidden (refetchIntervalInBackground:false), but that
 * does NOT force a fresh read the moment the tab returns. This listens for the
 * tab becoming visible and invalidates the live queries so the user sees
 * current state immediately on return — not relying on refetchOnWindowFocus,
 * which doesn't cover the pause-while-hidden→resume case on its own.
 */
export function useVisibilityRefetch() {
  const qc = useQueryClient();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      qc.invalidateQueries({ queryKey: queryKeyRoots.status });
      qc.invalidateQueries({ queryKey: queryKeyRoots.log });
      qc.invalidateQueries({ queryKey: queryKeyRoots.branches });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [qc]);
}
