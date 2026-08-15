export function StatCard({ icon: Icon, label, value, accent = 'text-slate-100', hint }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-900 p-4 shadow-panel">
      {Icon && (
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-800 ${accent}`}>
          <Icon size={20} strokeWidth={1.75} />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className={`font-mono text-2xl font-semibold leading-tight ${accent}`}>{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
