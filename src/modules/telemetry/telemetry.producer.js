import { config } from '../../config/index.js';
import { logger } from '../../shared/logger/logger.js';

/**
 * Publishes one telemetry event to the telemetry topic.
 *
 * Takes the producer as a parameter (rather than importing the
 * shared singleton directly) so this stays decoupled from how/where
 * that producer is constructed, and easy to unit test with a fake
 * producer — same pattern as the timeseries/idempotency repositories.
 *
 * Keyed by binId so all readings for a given bin land on the same
 * partition and are consumed in order; combined with the idempotent
 * producer (see kafkaClient.js), a retried send never results in a
 * duplicate message on the topic.
 */
export async function publishTelemetryEvent(producer, event) {
  try {
    const result = await producer.send({
      topic: config.kafka.telemetryTopic,
      messages: [
        {
          key: event.binId,
          value: JSON.stringify(event),
          headers: { eventId: event.eventId },
        },
      ],
    });

    logger.info(
      { eventId: event.eventId, binId: event.binId, topic: config.kafka.telemetryTopic },
      'Telemetry event published to Kafka',
    );

    return result;
  } catch (err) {
    logger.error(
      { err, eventId: event.eventId, binId: event.binId, topic: config.kafka.telemetryTopic },
      'Failed to publish telemetry event to Kafka',
    );
    throw err;
  }
}
