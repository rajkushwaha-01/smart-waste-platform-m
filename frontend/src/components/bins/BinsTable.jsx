import { Link } from 'react-router-dom';
import { Battery, Thermometer } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { EmptyState } from '../ui/States.jsx';
import { FILL_STATUS_STYLES, PRIORITY_STYLES } from '../../utils/constants.js';
import { formatPercent, formatRelativeTime } from '../../utils/formatters.js';

function FillBar({ value, fillStatus }) {
  const color =
    fillStatus === 'full' ? 'bg-red-500' : fillStatus === 'near_full' ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-700">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
      </div>
      <span className="font-mono text-xs text-slate-300">{formatPercent(value)}</span>
    </div>
  );
}

export function BinsTable({ bins, limit }) {
  if (!bins?.length) {
    return <EmptyState label="No bins match the current filters" />;
  }

  const rows = limit ? bins.slice(0, limit) : bins;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-surface-700 text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2 font-medium">Bin</th>
            <th className="px-3 py-2 font-medium">Fill Level</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Battery</th>
            <th className="px-3 py-2 font-medium">Temp</th>
            <th className="px-3 py-2 font-medium">Last Seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-800">
          {rows.map((bin) => (
            <tr key={bin.binId} className="transition hover:bg-surface-800/60">
              <td className="px-3 py-2.5">
                <Link
                  to={`/bins/${bin.binId}`}
                  className="font-mono text-sm font-medium text-cyan-300 hover:underline"
                >
                  {bin.binId}
                </Link>
                {bin.maintenanceRequired && (
                  <span className="ml-2 rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                    MAINT
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <FillBar value={bin.currentFillLevel} fillStatus={bin.fillStatus} />
              </td>
              <td className="px-3 py-2.5">
                <Badge style={PRIORITY_STYLES[bin.priority]} showDot />
              </td>
              <td className="px-3 py-2.5">
                <Badge style={FILL_STATUS_STYLES[bin.fillStatus]} />
              </td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400">
                  <Battery size={13} className={bin.battery < 20 ? 'text-red-400' : 'text-slate-500'} />
                  {formatPercent(bin.battery)}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400">
                  <Thermometer size={13} className="text-slate-500" />
                  {bin.temperature ?? '—'}°C
                </span>
              </td>
              <td className="px-3 py-2.5 text-xs text-slate-500">{formatRelativeTime(bin.lastTelemetryAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
