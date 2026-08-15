// Single source of truth for how each backend enum renders. Values
// here must match the backend's actual enums exactly (see
// src/modules/*/*.model.js in the backend) — never invent a status
// that the API doesn't return.

export const PRIORITY_STYLES = {
  critical: { label: 'CRITICAL', dot: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500/30', bg: 'bg-red-500/10' },
  high: { label: 'HIGH', dot: 'bg-orange-500', text: 'text-orange-400', ring: 'ring-orange-500/30', bg: 'bg-orange-500/10' },
  medium: { label: 'MEDIUM', dot: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-400/30', bg: 'bg-amber-400/10' },
  low: { label: 'LOW', dot: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/10' },
};

export const FILL_STATUS_STYLES = {
  full: { label: 'FULL', dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10' },
  near_full: { label: 'NEAR FULL', dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-400/10' },
  normal: { label: 'NORMAL', dot: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

export const ALERT_SEVERITY_STYLES = {
  critical: { label: 'CRITICAL', text: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/30', dot: 'bg-red-500' },
  high: { label: 'HIGH', text: 'text-orange-400', bg: 'bg-orange-500/10', ring: 'ring-orange-500/30', dot: 'bg-orange-500' },
  medium: { label: 'MEDIUM', text: 'text-amber-300', bg: 'bg-amber-400/10', ring: 'ring-amber-400/30', dot: 'bg-amber-400' },
  low: { label: 'LOW', text: 'text-slate-300', bg: 'bg-slate-500/10', ring: 'ring-slate-500/30', dot: 'bg-slate-400' },
};

export const ALERT_TYPE_LABELS = {
  overflow: 'Overflow Risk',
  battery_low: 'Low Battery',
  temperature_anomaly: 'High Temperature',
  sensor_fault: 'Sensor Fault',
  maintenance_required: 'Maintenance Required',
  critical_bin: 'Critical Bin',
};

export const ALERT_STATUS_STYLES = {
  open: { label: 'OPEN', text: 'text-red-400', bg: 'bg-red-500/10' },
  acknowledged: { label: 'ACKNOWLEDGED', text: 'text-amber-300', bg: 'bg-amber-400/10' },
  resolved: { label: 'RESOLVED', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

export const TASK_STATUS_STYLES = {
  pending: { label: 'PENDING', text: 'text-slate-300', bg: 'bg-slate-500/10' },
  assigned: { label: 'ASSIGNED', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  in_progress: { label: 'IN PROGRESS', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  completed: { label: 'COMPLETED', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  cancelled: { label: 'CANCELLED', text: 'text-slate-500', bg: 'bg-slate-600/10' },
};

export const BIN_STATUS_STYLES = {
  active: { label: 'ACTIVE', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  inactive: { label: 'INACTIVE', text: 'text-slate-400', bg: 'bg-slate-500/10' },
  maintenance: { label: 'MAINTENANCE', text: 'text-amber-300', bg: 'bg-amber-400/10' },
  offline: { label: 'OFFLINE', text: 'text-red-400', bg: 'bg-red-500/10' },
};

// Map marker color per fill status — used by the Leaflet map.
export const FILL_STATUS_MARKER_COLOR = {
  full: '#ef4444',
  near_full: '#fbbf24',
  normal: '#10b981',
};
