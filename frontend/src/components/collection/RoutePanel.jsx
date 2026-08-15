import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Loader2, MapPinned, RefreshCw, Timer } from 'lucide-react';
import { fetchOptimizedRoute } from '../../api/collection.js';
import { toApiError } from '../../api/client.js';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { formatNumber, formatTime } from '../../utils/formatters.js';

/**
 * Route generation calls an external optimization service on every
 * request (see backend modules/route), so — unlike the queue/alerts
 * views — this is fetched on-demand (mount + manual refresh) rather
 * than polled on an interval, to avoid hammering that external
 * service in the background.
 */
export function RoutePanel() {
  const [route, setRoute] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchOptimizedRoute();
      setRoute(result);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-surface-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Regenerate Route
        </button>
      </div>

      {loading && !route && (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Requesting optimized route…</span>
        </div>
      )}

      {!loading && error && (
        <ErrorState
          error={error}
          onRetry={load}
          label={
            error.status === 503
              ? 'Route optimization service is unavailable'
              : 'Failed to generate route'
          }
        />
      )}

      {!loading && !error && route && route.stops.length === 0 && (
        <EmptyState label="No route to optimize" hint="The collection queue is currently empty." />
      )}

      {!loading && !error && route && route.stops.length > 0 && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-surface-700 bg-surface-850 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
                <Gauge size={12} /> Total Distance
              </p>
              <p className="mt-1 font-mono text-lg text-slate-100">
                {route.totalDistanceKm !== null ? `${formatNumber(route.totalDistanceKm, 1)} km` : '—'}
              </p>
            </div>
            <div className="rounded-md border border-surface-700 bg-surface-850 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
                <Timer size={12} /> Est. Duration
              </p>
              <p className="mt-1 font-mono text-lg text-slate-100">
                {route.estimatedDurationMinutes !== null ? `${formatNumber(route.estimatedDurationMinutes)} min` : '—'}
              </p>
            </div>
          </div>

          <ol className="space-y-2">
            {route.stops.map((stop, index) => (
              <li
                key={stop.taskId ?? `${stop.binId}-${index}`}
                className="flex items-center gap-3 rounded-md border border-surface-700 bg-surface-850 px-3 py-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 font-mono text-xs font-semibold text-cyan-300">
                  {stop.sequence ?? index + 1}
                </span>
                <MapPinned size={14} className="shrink-0 text-slate-500" />
                <Link to={`/bins/${stop.binId}`} className="font-mono text-sm text-slate-200 hover:underline">
                  {stop.binId}
                </Link>
                {stop.estimatedArrival && (
                  <span className="ml-auto font-mono text-xs text-slate-500">
                    ETA {formatTime(stop.estimatedArrival)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
