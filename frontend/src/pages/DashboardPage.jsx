import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Battery,
  Gauge,
  ListChecks,
  Recycle,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell.jsx';
import { Card } from '../components/ui/Card.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { FillDistributionChart } from '../components/charts/FillDistributionChart.jsx';
import { TelemetryHistoryChart } from '../components/charts/TelemetryHistoryChart.jsx';
import { BinsMap } from '../components/map/BinsMap.jsx';
import { AlertsList } from '../components/alerts/AlertsList.jsx';
import { QueueTable } from '../components/collection/QueueTable.jsx';
import { RoutePanel } from '../components/collection/RoutePanel.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { fetchDashboardSummary } from '../api/dashboard.js';
import { fetchBins, fetchBinTelemetry } from '../api/bins.js';
import { fetchAlerts } from '../api/alerts.js';
import { fetchQueue, assignTask, completeTask } from '../api/collection.js';
import { formatPercent } from '../utils/formatters.js';

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export default function DashboardPage() {
  const summary = usePolling(fetchDashboardSummary);
  const bins = usePolling(() => fetchBins());
  const alerts = usePolling(() => fetchAlerts({ status: 'open' }));
  const queue = usePolling(fetchQueue);

  // Default the telemetry widget to whichever bin needs attention
  // most, so the dashboard surfaces something useful without the
  // operator having to pick first.
  const sortedBins = useMemo(
    () => [...(bins.data ?? [])].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)),
    [bins.data],
  );
  const [selectedBinId, setSelectedBinId] = useState(null);
  const activeBinId = selectedBinId ?? sortedBins[0]?.binId ?? null;

  const telemetry = usePolling(
    () => (activeBinId ? fetchBinTelemetry(activeBinId, { limit: 50 }) : Promise.resolve([])),
    [activeBinId],
  );

  async function handleAssign(taskId) {
    await assignTask(taskId);
    queue.refetch();
    summary.refetch();
  }

  async function handleComplete(taskId) {
    await completeTask(taskId);
    queue.refetch();
    summary.refetch();
    bins.refetch();
  }

  return (
    <AppShell title="Operations Dashboard" subtitle="City-wide waste collection overview">
      <div className="space-y-6">
        {/* 1-7: KPI stat row */}
        {summary.loading && <LoadingState label="Loading summary…" />}
        {!summary.loading && summary.error && <ErrorState error={summary.error} onRetry={summary.refetch} />}
        {!summary.loading && !summary.error && summary.data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <StatCard icon={Trash2} label="Total Bins" value={summary.data.totalBins} />
            <StatCard icon={Recycle} label="Normal" value={summary.data.normalBins} accent="text-emerald-400" />
            <StatCard icon={TrendingUp} label="Near Full" value={summary.data.nearFullBins} accent="text-amber-300" />
            <StatCard icon={AlertTriangle} label="Critical" value={summary.data.criticalBins} accent="text-red-400" />
            <StatCard icon={Gauge} label="Avg Fill Level" value={formatPercent(summary.data.averageFillLevel)} accent="text-cyan-400" />
            <StatCard icon={ListChecks} label="Active Tasks" value={summary.data.activeCollectionTasks} accent="text-blue-400" />
            <StatCard icon={Battery} label="Active Alerts" value={summary.data.activeAlerts} accent="text-orange-400" />
          </div>
        )}

        {/* 8: Fill-level analytics + 12: Bin locations */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Fill-Level Distribution" className="lg:col-span-1">
            {summary.data ? (
              <FillDistributionChart
                normal={summary.data.normalBins}
                nearFull={summary.data.nearFullBins}
                full={summary.data.criticalBins}
              />
            ) : (
              <LoadingState />
            )}
          </Card>
          <Card title="Bin Locations" className="lg:col-span-2">
            {bins.loading && <LoadingState />}
            {!bins.loading && bins.error && <ErrorState error={bins.error} onRetry={bins.refetch} />}
            {!bins.loading && !bins.error && <BinsMap bins={bins.data} />}
          </Card>
        </div>

        {/* 9: Historical telemetry + Recent alerts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card
            title="Telemetry History"
            className="lg:col-span-2"
            action={
              sortedBins.length > 0 && (
                <select
                  value={activeBinId ?? ''}
                  onChange={(e) => setSelectedBinId(e.target.value)}
                  className="rounded-md border border-surface-600 bg-surface-800 px-2 py-1 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  {sortedBins.map((bin) => (
                    <option key={bin.binId} value={bin.binId}>
                      {bin.binId} · {bin.priority}
                    </option>
                  ))}
                </select>
              )
            }
          >
            {!activeBinId && !bins.loading && <EmptyState label="No bins available yet" />}
            {activeBinId && telemetry.loading && <LoadingState />}
            {activeBinId && !telemetry.loading && telemetry.error && (
              <ErrorState error={telemetry.error} onRetry={telemetry.refetch} />
            )}
            {activeBinId && !telemetry.loading && !telemetry.error && (
              <TelemetryHistoryChart telemetry={telemetry.data} />
            )}
          </Card>
          <Card title="Active Alerts" className="lg:col-span-1" bodyClassName="px-4 py-2">
            {alerts.loading && <LoadingState />}
            {!alerts.loading && alerts.error && <ErrorState error={alerts.error} onRetry={alerts.refetch} />}
            {!alerts.loading && !alerts.error && <AlertsList alerts={alerts.data} limit={6} />}
          </Card>
        </div>

        {/* 10: Collection queue + 11: Optimized route */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Collection Queue" className="lg:col-span-1">
            {queue.loading && <LoadingState />}
            {!queue.loading && queue.error && <ErrorState error={queue.error} onRetry={queue.refetch} />}
            {!queue.loading && !queue.error && (
              <QueueTable tasks={(queue.data ?? []).slice(0, 5)} onAssign={handleAssign} onComplete={handleComplete} />
            )}
          </Card>
          <Card title="Optimized Collection Route" className="lg:col-span-2">
            <RoutePanel />
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
