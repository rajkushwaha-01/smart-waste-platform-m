import { Bin } from './bin.model.js';

export async function findByBinId(binId) {
  return Bin.findOne({ binId });
}

/**
 * Creates the bin on first sighting, or updates its live telemetry
 * fields on every subsequent reading. Using findOneAndUpdate with
 * upsert makes this a single atomic operation regardless of whether
 * the bin already exists — safe under concurrent telemetry consumers.
 */
export async function upsertFromTelemetry(
  binId,
  { fillLevel, battery, temperature, latitude, longitude, telemetryAt = new Date() },
) {
  return Bin.findOneAndUpdate(
    { binId },
    {
      $set: {
        currentFillLevel: fillLevel,
        battery,
        temperature,
        'location.latitude': latitude,
        'location.longitude': longitude,
        lastTelemetryAt: telemetryAt,
      },
      $setOnInsert: { status: 'active', priority: 'low' },
    },
    { upsert: true, new: true, runValidators: true },
  );
}

export async function updatePriority(binId, priority) {
  return Bin.findOneAndUpdate({ binId }, { $set: { priority } }, { new: true });
}

export async function setMaintenanceRequired(binId, maintenanceRequired) {
  return Bin.findOneAndUpdate({ binId }, { $set: { maintenanceRequired } }, { new: true });
}

export async function list({ status, priority } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  return Bin.find(filter).sort({ priority: -1, currentFillLevel: -1 });
}
