import { config } from './config/index.js';
import { logger } from './shared/logger/logger.js';
import { connectMongo, disconnectMongo } from './shared/database/mongo.js';
import { createConsumer } from './shared/messaging/kafkaClient.js';
import { runTelemetryConsumer } from './modules/telemetry/telemetry.consumer.js';

let consumer;
let shuttingDown = false;

async function bootstrap() {
  // Consumers write processed telemetry into MongoDB (idempotency
  // records, bin snapshots), so — like the API process — this worker
  // can't do anything useful without it.
  await connectMongo();
  logger.info('MongoDB ready');

  consumer = createConsumer({ groupId: config.kafka.groupId });
  await runTelemetryConsumer({ consumer });

  logger.info(
    { groupId: config.kafka.groupId, topic: config.kafka.telemetryTopic },
    'Telemetry consumer worker started',
  );
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Shutdown signal received, closing telemetry consumer gracefully');

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    if (consumer) await consumer.disconnect();
    await disconnectMongo();
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error while shutting down telemetry consumer worker');
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection in telemetry consumer worker');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception in telemetry consumer worker');
  shutdown('uncaughtException');
});

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start telemetry consumer worker');
  process.exit(1);
});

export { consumer };
