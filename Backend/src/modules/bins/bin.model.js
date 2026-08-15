import mongoose from 'mongoose';

// Not specified by the product spec — chosen as sensible MVP defaults.
// Kept as exported constants so business-logic modules (decision
// engine, dashboards) reuse the same source of truth instead of
// re-declaring these lists.
export const BIN_STATUS = ['active', 'inactive', 'maintenance', 'offline'];
export const BIN_PRIORITY = ['low', 'medium', 'high', 'critical'];

// Fill-level classification, driven by the decision engine's
// thresholds (see modules/decision/decisionEngine.js). Distinct from
// `status` above, which is the bin's operational/lifecycle state.
export const BIN_FILL_STATUS = ['normal', 'near_full', 'full'];

const binSchema = new mongoose.Schema(
  {
    binId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    location: {
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
    },
    currentFillLevel: { type: Number, min: 0, max: 100, default: 0 },
    battery: { type: Number, min: 0, max: 100, default: 100 },
    temperature: { type: Number, default: null },
    status: { type: String, enum: BIN_STATUS, default: 'active' },
    priority: { type: String, enum: BIN_PRIORITY, default: 'low' },
    fillStatus: { type: String, enum: BIN_FILL_STATUS, default: 'normal' },
    maintenanceRequired: { type: Boolean, default: false },
    // Set by the decision engine when the bin (currently, or per an
    // AI-enhanced prediction) needs a collection run — is there an
    // open/active CollectionTask driving this back to false again.
    collectionRequired: { type: Boolean, default: false },
    lastTelemetryAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// binId already gets a unique index from `unique: true` above.
binSchema.index({ status: 1 });
binSchema.index({ priority: 1 });
binSchema.index({ fillStatus: 1 });
binSchema.index({ lastTelemetryAt: 1 });

export const Bin = mongoose.model('Bin', binSchema);
