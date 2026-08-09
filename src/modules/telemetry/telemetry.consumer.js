import { config } from '../../config/index.js';
import { logger } from '../../shared/logger/logger.js';
import { createConsumer } from '../../shared/messaging/kafkaClient.js';
import { getTimeseriesClient } from '../../shared/database/timeseriesClient.js';
import { upsertFromTelemetry } from '../bins/bin.repository.js';
import { predictBinTelemetry } from '../ai/ai.service.js';
import { evaluateTelemetry } from '../decision/decisionEngine.js';
import { telemetrySchema } from './telemetry.schema.js';
import { claimEvent } from './idempotency.repository.js';
import { recordTelemetry } from './telemetryHistory.repository.js';

/**
 * Processes one decoded, already-validated telemetry event:
 *
 *  1. Claims the eventId (idempotency). Kafka gives at-least-once
 *     delivery, so the same message can arrive more than once (a
 *     redelivered message after a consumer restart, a retried
 *     ingestion request, etc) — claimEvent's unique index makes that
 *     safe across multiple parallel consumer instances, and a
 *     duplicate is simply skipped here.
 *  2. Records the reading to the time-series history store.
 *  3. Upserts the bin's live snapshot (current fill/battery/etc).
 *  4. Sends the reading to the external AI service for a prediction.
 *  5. Passes the telemetry + prediction into the decision engine,
 *     which derives bin priority, alerts, and collection tasks.
 *
 * Step 4 is deliberately fault-tolerant: an AI failure (after
 * ai.client's own retries are exhausted) is logged and the pipeline
 * continues with `prediction: null` rather than failing the whole
 * event — one AI outage must never crash or permanently stall the
 * consumer, and telemetry/bin-state writes that already succeeded
 * above should not be redone or lost because of it.
 *
 * Exported standalone with injectable dependencies so it's fully
 * unit-testable without a running Kafka broker, database, or AI
 * service.
 */
export async function processTelemetryEvent(event, deps = {}) {
  const {
    claim = claimEvent,
    record = recordTelemetry,
    upsertBin = upsertFromTelemetry,
    predict = predictBinTelemetry,
    evaluate = evaluateTelemetry,
    timeseriesClient = getTimeseriesClient(config),
  } = deps;

  const claimed = await claim(event.eventId, event.binId);
  if (!claimed) {
    logger.info(
      { eventId: event.eventId, binId: event.binId },
      'Duplicate telemetry event skipped',
    );
    return { processed: false, reason: 'duplicate' };
  }

  await record(timeseriesClient, event);
  const bin = await upsertBin(event.binId, {
    fillLevel: event.fillLevel,
    battery: event.battery,
    temperature: event.temperature,
    latitude: event.latitude,
    longitude: event.longitude,
    telemetryAt: new Date(event.timestamp),
  });

  let prediction = null;
  try {
    prediction = await predict(event);
  } catch (err) {
    logger.error(
      { err, eventId: event.eventId, binId: event.binId },
      'AI prediction failed after retries, proceeding without a prediction',
    );
  }

  const decision = await evaluate({ event, prediction, bin });

  logger.info(
    { eventId: event.eventId, binId: event.binId, priority: decision.priority },
    'Telemetry event processed',
  );
  return { processed: true, prediction, decision };
}

function decodeMessage(message) {
  const raw = JSON.parse(message.value.toString('utf8'));
  return telemetrySchema.parse(raw);
}

/**
 * Wires a consumer instance up to the telemetry topic and starts
 * consuming. Designed so multiple instances of this (each its own
 * process, e.g. via `npm run worker`) can run in parallel: they all
 * join the same consumer group (config.kafka.groupId) and Kafka
 * balances topic partitions across them automatically — no
 * coordination needed here beyond that.
 */
export async function runTelemetryConsumer({ consumer = createConsumer() } = {}) {
  await consumer.connect();
  await consumer.subscribe({ topic: config.kafka.telemetryTopic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let event;
      try {
        event = decodeMessage(message);
      } catch (err) {
        // A malformed/invalid message can never succeed on retry, so
        // it's logged and dropped rather than crashing the consumer
        // (which would stall the whole partition). A dead-letter
        // topic would be the next step beyond this MVP's single topic.
        logger.error(
          { err, topic, partition, offset: message.offset },
          'Discarding unprocessable telemetry message',
        );
        return;
      }

      try {
        await processTelemetryEvent(event);
      } catch (err) {
        // A transient failure (DB hiccup, etc) — rethrow so kafkajs
        // does not commit the offset, and the message is redelivered
        // on the next poll instead of being silently lost.
        logger.error(
          { err, topic, partition, offset: message.offset, eventId: event.eventId },
          'Failed to process telemetry message, will be redelivered',
        );
        throw err;
      }
    },
  });

  return consumer;
}
