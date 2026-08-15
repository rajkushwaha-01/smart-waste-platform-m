import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '../api/client.js';

/**
 * Runs an async fetcher and exposes { data, error, loading, refetch }.
 *
 * - `loading` is only true for the FIRST load — a background refetch
 *   (e.g. from polling) updates `data`/`error` without flashing a
 *   loading state over content that's already on screen.
 * - `deps` re-runs the fetch when any dependency changes (e.g. a
 *   filter or a route param), same as useEffect's dependency array.
 */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    hasLoadedOnce.current = false;
    load();
  }, [load]);

  return { data, error, loading, refetch: load };
}
