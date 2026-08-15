import { env } from './env.js';

/**
 * Single source of truth for runtime configuration, grouped by domain.
 * Modules should import `config` from here rather than reading `env`
 * (or `process.env`) directly.
 */
export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
  },

  mongo: {
    uri: env.MONGODB_URI,
  },

  kafka: {
    brokers: env.KAFKA_BROKERS.split(',').map((broker) => broker.trim()),
    clientId: env.KAFKA_CLIENT_ID,
    groupId: env.KAFKA_GROUP_ID,
    telemetryTopic: env.KAFKA_TELEMETRY_TOPIC,
    connectionTimeoutMs: env.KAFKA_CONNECTION_TIMEOUT_MS,
    requestTimeoutMs: env.KAFKA_REQUEST_TIMEOUT_MS,
    consumerSessionTimeoutMs: env.KAFKA_CONSUMER_SESSION_TIMEOUT_MS,
    retry: {
      initialRetryTimeMs: env.KAFKA_RETRY_INITIAL_RETRY_TIME_MS,
      retries: env.KAFKA_RETRY_RETRIES,
    },
  },

  timeseries: {
    url: env.TIMESERIES_DB_URL,
    dbName: env.TIMESERIES_DB_NAME,
    user: env.TIMESERIES_DB_USER,
    password: env.TIMESERIES_DB_PASSWORD,
    timeoutMs: env.TIMESERIES_DB_TIMEOUT,
  },

  aiService: {
    baseUrl: env.AI_SERVICE_URL,
    timeoutMs: env.AI_SERVICE_TIMEOUT,
    predictPath: env.AI_SERVICE_PREDICT_PATH,
    apiKey: env.AI_SERVICE_API_KEY,
    maxRetries: env.AI_SERVICE_MAX_RETRIES,
    retryDelayMs: env.AI_SERVICE_RETRY_DELAY_MS,
  },

  routeService: {
    baseUrl: env.ROUTE_SERVICE_URL,
    timeoutMs: env.ROUTE_SERVICE_TIMEOUT,
  },

  cors: {
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  },
};
