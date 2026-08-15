import { useEffect, useRef } from 'react';
import { useApi } from './useApi.js';

const DEFAULT_INTERVAL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 10000);

/**
 * Same contract as useApi, plus a background interval refetch — the
 * lightweight "make it feel live" mechanism this app uses instead of
 * WebSockets. Polling pauses while the browser tab is hidden, so it
 * doesn't burn requests (or the backend's rate limit) in background
 * tabs, and resumes immediately when the tab becomes visible again.
 */
export function usePolling(fetcher, deps = [], intervalMs = DEFAULT_INTERVAL_MS) {
  const result = useApi(fetcher, deps);
  const refetchRef = useRef(result.refetch);
  refetchRef.current = result.refetch;

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') {
        refetchRef.current();
      }
    };
    const id = setInterval(tick, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs]);

  return result;
}
