import { Kafka, Partitioners, logLevel } from 'kafkajs';

import { config } from '../../config/index.js';
import { logger } from '../logger/logger.js';

const KAFKAJS_TO_PINO_LEVEL = {
  [logLevel.NOTHING]: 'silent',
  [logLevel.ERROR]: 'error',
  [logLevel.WARN]: 'warn',
  [logLevel.INFO]: 'info',
  [logLevel.DEBUG]: 'debug',
};

/**
 * Routes kafkajs's internal logs through the app's pino logger so
 * Kafka connection/retry/broker events show up as structured logs
 * alongside everything else, instead of kafkajs's own console output.
 */
function pinoLogCreator() {
  return ({ namespace, level, log }) => {
    const { message, ...rest } = log;
    const pinoLevel = KAFKAJS_TO_PINO_LEVEL[level] ?? 'info';
    if (pinoLevel === 'silent') {
      return;
    }
    logger[pinoLevel]({ namespace, ...rest }, message);
  };
}

let kafkaSingleton;

/**
 * Lazily creates and returns the process-wide Kafka client, configured
 * entirely from central config — brokers, client id, timeouts, and
 * retry behaviour are all env-driven (see config/env.js), nothing is
 * hardcoded here.
 */
export function getKafka() {
  if (!kafkaSingleton) {
    kafkaSingleton = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      connectionTimeout: config.kafka.connectionTimeoutMs,
      requestTimeout: config.kafka.requestTimeoutMs,
      retry: {
        initialRetryTime: config.kafka.retry.initialRetryTimeMs,
        retries: config.kafka.retry.retries,
      },
      logCreator: pinoLogCreator,
    });
  }
  return kafkaSingleton;
}

let producerSingleton;
let producerConnected = false;

function attachProducerListeners(producer) {
  producer.on(producer.events.CONNECT, () => {
    producerConnected = true;
    logger.info('Kafka producer connected');
  });
  producer.on(producer.events.DISCONNECT, () => {
    producerConnected = false;
    logger.warn('Kafka producer disconnected');
  });
  producer.on(producer.events.REQUEST_TIMEOUT, ({ payload }) =>
    logger.warn({ payload }, 'Kafka producer request timed out'),
  );
}

/**
 * Lazily creates and returns the process-wide producer instance.
 * `idempotent: true` gives exactly-once-per-partition publish
 * semantics — if a send is retried internally after a transient
 * broker error, the broker de-duplicates it rather than writing the
 * message twice.
 */
export function getProducer() {
  if (!producerSingleton) {
    producerSingleton = getKafka().producer({
      idempotent: true,
      createPartitioner: Partitioners.DefaultPartitioner,
    });
    attachProducerListeners(producerSingleton);
  }
  return producerSingleton;
}

/** Best-effort liveness signal for the shared producer, used by the
 * health endpoint. Not a substitute for handling publish errors. */
export function getProducerConnectionStatus() {
  return producerConnected ? 'connected' : 'disconnected';
}

/**
 * Connects the shared producer. Connection failures/retries are
 * handled by kafkajs per the retry config above; this only surfaces
 * the outcome to the caller so bootstrap code can decide whether a
 * failed connection should be fatal.
 */
export async function connectProducer() {
  const producer = getProducer();
  await producer.connect();
  return producer;
}

export async function disconnectProducer() {
  if (!producerSingleton) return;
  await producerSingleton.disconnect();
}

/**
 * Creates a new consumer bound to a consumer group. Each call returns
 * a fresh consumer instance (never a singleton) — this is what lets
 * multiple consumer process instances join the same group and have
 * Kafka balance partitions across them for parallel processing.
 */
export function createConsumer({ groupId = config.kafka.groupId } = {}) {
  const consumer = getKafka().consumer({
    groupId,
    sessionTimeout: config.kafka.consumerSessionTimeoutMs,
  });

  consumer.on(consumer.events.CONNECT, () => logger.info({ groupId }, 'Kafka consumer connected'));
  consumer.on(consumer.events.DISCONNECT, () =>
    logger.warn({ groupId }, 'Kafka consumer disconnected'),
  );
  consumer.on(consumer.events.GROUP_JOIN, ({ payload }) =>
    logger.info(
      { groupId, memberId: payload.memberId, leaderId: payload.leaderId },
      'Kafka consumer joined group',
    ),
  );
  consumer.on(consumer.events.CRASH, ({ payload }) =>
    logger.error(
      { groupId, err: payload.error, willRestart: payload.restart },
      'Kafka consumer crashed',
    ),
  );

  return consumer;
}
