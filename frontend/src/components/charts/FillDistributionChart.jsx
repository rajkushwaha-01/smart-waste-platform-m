import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FILL_STATUS_MARKER_COLOR } from '../../utils/constants.js';

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="rounded-md border border-surface-600 bg-surface-800 px-3 py-2 text-xs shadow-panel">
      <p className="font-medium text-slate-200">{name}</p>
      <p className="font-mono text-slate-400">{value} bins</p>
    </div>
  );
}

export function FillDistributionChart({ normal, nearFull, full }) {
  const data = [
    { key: 'normal', name: 'Normal', value: normal ?? 0 },
    { key: 'near_full', name: 'Near Full', value: nearFull ?? 0 },
    { key: 'full', name: 'Critical / Full', value: full ?? 0 },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1b232d' }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#1b232d' }}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={FILL_STATUS_MARKER_COLOR[entry.key]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
