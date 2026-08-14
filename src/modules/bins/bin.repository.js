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

/**
 * Applies the decision engine's computed output to a bin in one
 * atomic write, rather than several separate field-setter calls.
 * `fillStatus`/`priority`/`maintenanceRequired`/`collectionRequired`
 * are all derived together from the same telemetry+prediction
 * evaluation, so they're persisted together too.
 */
export async function applyDecisionState(
  binId,
  { fillStatus, priority, maintenanceRequired, collectionRequired },
) {
  return Bin.findOneAndUpdate(
    { binId },
    { $set: { fillStatus, priority, maintenanceRequired, collectionRequired } },
    { new: true, runValidators: true },
  );
}

export async function list({ status, priority } = {}) {
  const filter = {};
  if (status) {
    filter.status = status;
  }
  if (priority) {
    filter.priority = priority;
  }
  return Bin.find(filter).sort({ priority: -1, currentFillLevel: -1 });
}

/**
 * Fetches multiple bins by binId in one query. Used to resolve
 * collection-task locations before requesting route generation —
 * CollectionTask only stores binId, not coordinates.
 */
export async function findManyByBinIds(binIds) {
  if (!Array.isArray(binIds) || binIds.length === 0) {
    return [];
  }
  return Bin.find({ binId: { $in: binIds } }).lean();
}

const EMPTY_SUMMARY_STATS = {
  totalBins: 0,
  normalBins: 0,
  nearFullBins: 0,
  fullBins: 0,
  averageFillLevel: 0,
};

/**
 * Single-pass aggregate for the dashboard summary — counts bins by
 * fillStatus and averages currentFillLevel across the whole
 * collection, computed in Mongo rather than pulling every bin
 * document into the app to tally in memory.
 */
export async function getSummaryStats() {
  const [result] = await Bin.aggregate([
    {
      $group: {
        _id: null,
        totalBins: { $sum: 1 },
        normalBins: { $sum: { $cond: [{ $eq: ['$fillStatus', 'normal'] }, 1, 0] } },
        nearFullBins: { $sum: { $cond: [{ $eq: ['$fillStatus', 'near_full'] }, 1, 0] } },
        fullBins: { $sum: { $cond: [{ $eq: ['$fillStatus', 'full'] }, 1, 0] } },
        averageFillLevel: { $avg: '$currentFillLevel' },
      },
    },
  ]);

  return result
    ? { ...EMPTY_SUMMARY_STATS, ...result, averageFillLevel: result.averageFillLevel ?? 0 }
    : EMPTY_SUMMARY_STATS;
}
