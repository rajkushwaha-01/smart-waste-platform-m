import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge.jsx';
import { EmptyState } from '../ui/States.jsx';
import { ALERT_SEVERITY_STYLES, ALERT_STATUS_STYLES, ALERT_TYPE_LABELS } from '../../utils/constants.js';
import { formatRelativeTime } from '../../utils/formatters.js';

export function AlertsList({ alerts, limit }) {
  if (!alerts?.length) {
    return <EmptyState label="No alerts" hint="Everything is within normal operating thresholds." />;
  }

  const rows = limit ? alerts.slice(0, limit) : alerts;

  return (
    <ul className="divide-y divide-surface-800">
      {rows.map((alert) => (
        <li key={alert._id} className="flex items-start gap-3 py-3">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ALERT_SEVERITY_STYLES[alert.severity]?.dot ?? 'bg-slate-500'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge style={ALERT_SEVERITY_STYLES[alert.severity]} />
              <span className="text-xs font-medium text-slate-300">
                {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
              </span>
              <Link to={`/bins/${alert.binId}`} className="font-mono text-xs text-cyan-300 hover:underline">
                {alert.binId}
              </Link>
            </div>
            <p className="mt-1 truncate text-sm text-slate-400">{alert.message}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge style={ALERT_STATUS_STYLES[alert.status]} />
            <span className="text-[11px] text-slate-600">{formatRelativeTime(alert.createdAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
