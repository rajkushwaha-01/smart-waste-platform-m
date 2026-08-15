import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Battery, Gauge, MapPin, Thermometer, Wrench } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { TelemetryHistoryChart } from '../components/charts/TelemetryHistoryChart.jsx';
import { BinsMap } from '../components/map/BinsMap.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { fetchBin, fetchBinTelemetry } from '../api/bins.js';
import { FILL_STATUS_STYLES, PRIORITY_STYLES, BIN_STATUS_STYLES } from '../utils/constants.js';
import { formatDateTime, formatPercent, formatRelativeTime } from '../utils/formatters.js';

function Metric({ icon: Icon, label, value, accent = 'text-slate-100' }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-surface-700 bg-surface-850 px-3 py-2.5">
      <Icon size={16} className="text-slate-500" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`font-mono text-sm font-medium ${accent}`}>{value}</p>
      </div>
    </div>
  );
}

export default function BinDetailPage() {
  const { binId } = useParams();

  const bin = usePolling(() => fetchBin(binId), [binId], 8000);
  const telemetry = usePolling(() => fetchBinTelemetry(binId, { limit: 100 }), [binId], 8000);

  return (
    <AppShell title={`Bin ${binId}`} subtitle="Detail & historical telemetry">
      <div className="mb-4">
        <Link to="/bins" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft size={13} /> Back to all bins
        </Link>
      </div>

      {bin.loading && <LoadingState label="Loading bin…" />}
      {!bin.loading && bin.error && (
        <ErrorState
          error={bin.error}
          onRetry={bin.refetch}
          label={bin.error.status === 404 ? 'Bin not found' : 'Failed to load bin'}
        />
      )}

      {!bin.loading && !bin.error && bin.data && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-xl font-semibold text-slate-100">{bin.data.binId}</h2>
                <Badge style={PRIORITY_STYLES[bin.data.priority]} showDot />
                <Badge style={FILL_STATUS_STYLES[bin.data.fillStatus]} />
                <Badge style={BIN_STATUS_STYLES[bin.data.status]} />
                {bin.data.maintenanceRequired && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                    <Wrench size={12} /> MAINTENANCE REQUIRED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Last telemetry {formatRelativeTime(bin.data.lastTelemetryAt)}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Metric icon={Gauge} label="Fill Level" value={formatPercent(bin.data.currentFillLevel)} accent="text-cyan-400" />
              <Metric
                icon={Battery}
                label="Battery"
                value={formatPercent(bin.data.battery)}
                accent={bin.data.battery < 20 ? 'text-red-400' : 'text-slate-100'}
              />
              <Metric icon={Thermometer} label="Temperature" value={`${bin.data.temperature ?? '—'}°C`} />
              <Metric
                icon={MapPin}
                label="Location"
                value={`${bin.data.location.latitude.toFixed(4)}, ${bin.data.location.longitude.toFixed(4)}`}
              />
              <Metric icon={Gauge} label="Last Update" value={formatDateTime(bin.data.lastTelemetryAt)} />
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Telemetry History" className="lg:col-span-2">
              {telemetry.loading && <LoadingState />}
              {!telemetry.loading && telemetry.error && (
                <ErrorState error={telemetry.error} onRetry={telemetry.refetch} />
              )}
              {!telemetry.loading && !telemetry.error && <TelemetryHistoryChart telemetry={telemetry.data} />}
            </Card>
            <Card title="Location" className="lg:col-span-1">
              <BinsMap bins={[bin.data]} />
            </Card>
          </div>

          <Card title="Raw Telemetry Readings">
            {telemetry.loading && <LoadingState />}
            {!telemetry.loading && !telemetry.error && !telemetry.data?.length && (
              <EmptyState label="No telemetry recorded yet" />
            )}
            {!telemetry.loading && !telemetry.error && telemetry.data?.length > 0 && (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-surface-900">
                    <tr className="border-b border-surface-700 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Event ID</th>
                      <th className="px-3 py-2 font-medium">Fill Level</th>
                      <th className="px-3 py-2 font-medium">Battery</th>
                      <th className="px-3 py-2 font-medium">Temperature</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800">
                    {telemetry.data.map((point) => (
                      <tr key={point.eventId}>
                        <td className="px-3 py-2 font-mono text-xs text-slate-400">{formatDateTime(point.time)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{point.eventId}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-300">{formatPercent(point.fillLevel)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-300">{formatPercent(point.battery)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-300">{point.temperature}°C</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
