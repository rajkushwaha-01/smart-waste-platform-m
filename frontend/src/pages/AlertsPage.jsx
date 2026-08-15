import { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.jsx';
import { Card } from '../components/ui/Card.jsx';
import { LoadingState, ErrorState } from '../components/ui/States.jsx';
import { AlertsList } from '../components/alerts/AlertsList.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { fetchAlerts } from '../api/alerts.js';

const STATUS_OPTIONS = ['open', 'acknowledged', 'resolved'];
const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

export default function AlertsPage() {
  const [status, setStatus] = useState('open');
  const [severity, setSeverity] = useState('');

  const alerts = usePolling(() => fetchAlerts({ status, severity }), [status, severity]);

  return (
    <AppShell title="Alerts" subtitle="Bin overflow, battery, temperature, and sensor conditions">
      <Card
        title={`Alerts${alerts.data ? ` (${alerts.data.length})` : ''}`}
        action={
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="rounded-md border border-surface-600 bg-surface-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="">All severities</option>
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        }
        bodyClassName="px-4 py-2"
      >
        {alerts.loading && <LoadingState label="Loading alerts…" />}
        {!alerts.loading && alerts.error && <ErrorState error={alerts.error} onRetry={alerts.refetch} />}
        {!alerts.loading && !alerts.error && <AlertsList alerts={alerts.data} />}
      </Card>
    </AppShell>
  );
}
