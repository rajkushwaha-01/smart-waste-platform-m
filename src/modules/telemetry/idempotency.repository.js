import { ProcessedEvent } from './processedEvent.model.js';

const DUPLICATE_KEY_ERROR_CODE = 11000;

/**
 * Atomically claims an eventId as "being processed".
 *
 * Returns true if THIS call claimed it (new event — go ahead and
 * process it), or false if it was already claimed (duplicate — safe
 * to skip). Relies on the unique index on `eventId` rather than a
 * check-then-write, so concurrent Kafka consumer instances racing on
 * the same eventId resolve correctly at the database level instead
 * of via in-memory state (which wouldn't be safe across instances or
 * survive a restart).
 */
export async function claimEvent(eventId, binId) {
  try {
    await ProcessedEvent.create({ eventId, binId });
    return true;
  } catch (err) {
    if (err.code === DUPLICATE_KEY_ERROR_CODE) {
      return false;
    }
    throw err;
  }
}

export async function isEventProcessed(eventId) {
  const existing = await ProcessedEvent.findOne({ eventId }).lean();
  return existing !== null;
}
