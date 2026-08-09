import { getProducer } from '../../shared/messaging/kafkaClient.js';
import { ServiceUnavailableError } from '../../shared/errors/AppError.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { telemetrySchema } from './telemetry.schema.js';
import { publishTelemetryEvent } from './telemetry.producer.js';

/**
 * POST /api/v1/telemetry — the single official IoT ingestion
 * endpoint. Real devices and the Mock IoT simulator both call this
 * same route; there is no separate mock-data endpoint.
 *
 * Flow: validate -> publish to Kafka -> acknowledge. Processing
 * (dedup, persistence, decisioning) happens asynchronously in the
 * telemetry consumer — nothing AI- or business-logic-related runs
 * synchronously on this request path, so ingestion stays fast and
 * decoupled from downstream processing.
 */
export const ingestTelemetry = asyncHandler(async (req, res) => {
  const event = telemetrySchema.parse(req.body);

  try {
    await publishTelemetryEvent(getProducer(), event);
  } catch (err) {
    // The event was valid but couldn't be handed off to Kafka (broker
    // unreachable, timeout, etc). This is the caller's problem to
    // retry, not a client error — surfaced as 503 rather than 500 so
    // well-behaved IoT devices/simulators know to back off and retry.
    throw new ServiceUnavailableError(
      'Telemetry could not be accepted right now, please retry',
      { eventId: event.eventId, cause: err.message },
    );
  }

  res.status(202).json({
    status: 'accepted',
    eventId: event.eventId,
    binId: event.binId,
  });
});
