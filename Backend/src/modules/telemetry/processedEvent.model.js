import mongoose from 'mongoose';

/**
 * One document per successfully-claimed telemetry eventId. The
 * unique index on eventId is what actually enforces idempotency —
 * see telemetry/idempotency.repository.js for how it's used.
 *
 * A TTL index expires entries after 7 days. Kafka's own retention
 * window bounds how long a duplicate redelivery could arrive, so
 * dedup records don't need to live forever — this keeps the
 * collection bounded regardless of telemetry volume.
 */
const processedEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, trim: true },
  binId: { type: String, required: true, trim: true },
  processedAt: { type: Date, default: Date.now },
});

processedEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const ProcessedEvent = mongoose.model('ProcessedEvent', processedEventSchema);
