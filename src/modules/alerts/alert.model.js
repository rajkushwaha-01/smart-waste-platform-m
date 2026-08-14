import mongoose from 'mongoose';

export const ALERT_TYPE = [
  'overflow',
  'battery_low',
  'temperature_anomaly',
  'sensor_fault',
  'maintenance_required',
  'critical_bin',
];
export const ALERT_SEVERITY = ['low', 'medium', 'high', 'critical'];
export const ALERT_STATUS = ['open', 'acknowledged', 'resolved'];

const alertSchema = new mongoose.Schema(
  {
    binId: { type: String, required: true, trim: true },
    type: { type: String, enum: ALERT_TYPE, required: true },
    severity: { type: String, enum: ALERT_SEVERITY, default: 'medium' },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ALERT_STATUS, default: 'open' },
  },
  { timestamps: true }, // `createdAt` from the spec comes from this
);

alertSchema.index({ binId: 1, status: 1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ createdAt: -1 });

// Idempotency at the data layer: don't raise a second open alert of
// the same type for the same bin — repeated telemetry-driven checks
// should not flood the alert list.
alertSchema.index(
  { binId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'open' },
    name: 'uniq_open_alert_per_bin_type',
  },
);

export const Alert = mongoose.model('Alert', alertSchema);
