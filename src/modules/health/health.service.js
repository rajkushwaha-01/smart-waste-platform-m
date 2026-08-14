import { config } from '../../config/index.js';
import { getMongoConnectionStatus } from '../../shared/database/mongo.js';
import { getProducerConnectionStatus } from '../../shared/messaging/kafkaClient.js';

/**
 * MongoDB and the Kafka producer both track connection state
 * in-process at zero cost (mongoose.connection.readyState / producer
 * CONNECT-DISCONNECT events), so both are reported live here.
 *
 * The time-series client is a plain HTTP adapter with no persistent
 * connection state (see timeseriesClient.js) — reporting its live
 * reachability would mean an extra network call on every health
 * check, which is a bad trade-off for a liveness endpoint that load
 * balancers poll frequently. It's reported as "configured" instead;
 * a dedicated readiness check can call client.ping() if ever needed.
 *
 * AI service/Route service aren't wired up yet, so those stay as an
 * explicit 'unknown' extension point until their client modules exist.
 */
export function getHealthStatus() {
  const dependencies = {
    mongodb: { configured: Boolean(config.mongo.uri), status: getMongoConnectionStatus() },
    kafka: {
      configured: Boolean(config.kafka.brokers.length),
      status: getProducerConnectionStatus(),
    },
    timeseriesDb: { configured: Boolean(config.timeseries.url), status: 'unknown' },
    aiService: { configured: Boolean(config.aiService.baseUrl), status: 'unknown' },
    routeService: { configured: Boolean(config.routeService.baseUrl), status: 'unknown' },
  };

  return {
    status: 'ok',
    environment: config.env,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    dependencies,
  };
}
