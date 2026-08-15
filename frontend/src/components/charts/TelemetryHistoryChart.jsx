import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatTime } from '../../utils/formatters.js';
import { EmptyState } from '../ui/States.jsx';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-surface-600 bg-surface-800 px-3 py-2 text-xs shadow-panel">
      <p className="mb-1 font-mono text-slate-400">{formatTime(label)}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value}
          {entry.dataKey === 'temperature' ? '°C' : '%'}
        </p>
      ))}
    </div>
  );
}

/**
 * `telemetry` is the raw array from GET /bins/:binId/telemetry
 * (newest-first, per the backend's InfluxDB query). Charts read
 * left-to-right chronologically, so it's reversed here.
 */
export function TelemetryHistoryChart({ telemetry }) {
  if (!telemetry?.length) {
    return <EmptyState label="No historical telemetry in this range" />;
  }

  const data = [...telemetry].reverse().map((point) => ({
    time: point.time,
    fillLevel: point.fillLevel,
    battery: point.battery,
    temperature: point.temperature,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="#1b232d" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={formatTime}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={{ stroke: '#1b232d' }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          yAxisId="pct"
          domain={[0, 100]}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={{ stroke: '#1b232d' }}
          tickLine={false}
          width={32}
        />
        <YAxis
          yAxisId="temp"
          orientation="right"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={{ stroke: '#1b232d' }}
          tickLine={false}
          width={32}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} iconSize={8} />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="fillLevel"
          name="Fill Level"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="battery"
          name="Battery"
          stroke="#a78bfa"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="temperature"
          name="Temperature"
          stroke="#fb923c"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
