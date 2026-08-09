import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './shared/logger/logger.js';
import { connectMongo, disconnectMongo } from './shared/database/mongo.js';
import { getTimeseriesClient } from './shared/database/timeseriesClient.js';
import { connectProducer, disconnectProducer } from './shared/messaging/kafkaClient.js';

let server;
let shuttingDown = false;

// Populated once the corresponding resource is actually open, so
// shutdown only tries to close what was successfully started.
const closables = [];

async function bootstrap() {
  // MongoDB holds current operational state — the API can't do
  // anything useful without it, so a failed connection here is fatal
  // and the process should exit rather than serve broken requests.
  await connectMongo();
  logger.info('MongoDB ready');
  closables.push(() => disconnectMongo());

  // The time-series client is a stateless HTTP adapter (see
  // timeseriesClient.js) — it has nothing to "connect" up front, so
  // it's just instantiated. close() is still registered for symmetry
  // and so future implementations that DO hold a connection work
  // without changing this file.
  const timeseriesClient = getTimeseriesClient(config);
  closables.push(() => timeseriesClient.close());

  // The telemetry ingestion endpoint publishes every accepted event
  // to Kafka before acknowledging, so — like Mongo — a producer that
  // can't connect at boot means the API can't do its one job.
  // kafkajs retries the underlying broker connection per
  // config.kafka.retry before this rejects.
  await connectProducer();
  logger.info('Kafka producer ready');
  closables.push(() => disconnectProducer());

  const app = createApp();

  server = app.listen(config.server.port, () => {
    logger.info(
      { port: config.server.port, env: config.env },
      `smart-waste-backend listening on port ${config.server.port}`,
    );
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Shutdown signal received, closing server gracefully');

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  const closeHttpServer = () =>
    new Promise((resolve) => {
      if (!server) return resolve();
      server.close((err) => {
        if (err) {
          logger.error({ err }, 'Error while closing HTTP server');
        } else {
          logger.info('HTTP server closed');
        }
        resolve();
      });
    });

  try {
    await closeHttpServer();
    await Promise.all(closables.map((close) => close()));
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error while closing a dependency connection');
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start smart-waste-backend');
  process.exit(1);
});

export { server };
