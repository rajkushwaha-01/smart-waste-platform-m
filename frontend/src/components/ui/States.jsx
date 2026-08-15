import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
      <Loader2 size={22} className="animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry, label = 'Failed to load data' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <AlertTriangle size={22} className="text-red-400" />
      <p className="text-sm font-medium text-red-300">{label}</p>
      {error?.message && <p className="max-w-sm text-xs text-slate-500">{error.message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-surface-700"
        >
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ label = 'Nothing to show', hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-slate-500">
      <Inbox size={22} />
      <p className="text-sm">{label}</p>
      {hint && <p className="text-xs text-slate-600">{hint}</p>}
    </div>
  );
}
