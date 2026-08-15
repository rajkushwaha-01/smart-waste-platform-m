const STATUS_OPTIONS = ['active', 'inactive', 'maintenance', 'offline'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BinFilters({ status, priority, onStatusChange, onPriorityChange }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Select label="Status" value={status} onChange={onStatusChange} options={STATUS_OPTIONS} />
      <Select label="Priority" value={priority} onChange={onPriorityChange} options={PRIORITY_OPTIONS} />
    </div>
  );
}
