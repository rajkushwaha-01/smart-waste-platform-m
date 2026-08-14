import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the backend depends on is declared here.
 * Nothing outside this module should read `process.env` directly —
 * that keeps configuration centralized and validated in one place.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  KAFKA_BROKERS: z.string().min(1, 'KAFKA_BROKERS is required'),
  KAFKA_CLIENT_ID: z.string().min(1, 'KAFKA_CLIENT_ID is required'),
  KAFKA_GROUP_ID: z.string().min(1, 'KAFKA_GROUP_ID is required'),
  KAFKA_TELEMETRY_TOPIC: z.string().min(1, 'KAFKA_TELEMETRY_TOPIC is required'),
  KAFKA_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  KAFKA_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  KAFKA_RETRY_INITIAL_RETRY_TIME_MS: z.coerce.number().int().positive().default(300),
  KAFKA_RETRY_RETRIES: z.coerce.number().int().nonnegative().default(8),
  KAFKA_CONSUMER_SESSION_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  TIMESERIES_DB_URL: z.string().min(1, 'TIMESERIES_DB_URL is required'),
  TIMESERIES_DB_NAME: z.string().min(1, 'TIMESERIES_DB_NAME is required'),
  TIMESERIES_DB_USER: z.string().optional().default(''),
  TIMESERIES_DB_PASSWORD: z.string().optional().default(''),
  TIMESERIES_DB_TIMEOUT: z.coerce.number().int().positive().default(5000),

  AI_SERVICE_URL: z.string().min(1, 'AI_SERVICE_URL is required'),
  AI_SERVICE_TIMEOUT: z.coerce.number().int().positive().default(5000),
  AI_SERVICE_PREDICT_PATH: z.string().min(1).default('/api/v1/predict'),
  AI_SERVICE_API_KEY: z.string().optional().default(''),
  AI_SERVICE_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  AI_SERVICE_RETRY_DELAY_MS: z.coerce.number().int().positive().default(200),

  ROUTE_SERVICE_URL: z.string().min(1, 'ROUTE_SERVICE_URL is required'),
  ROUTE_SERVICE_TIMEOUT: z.coerce.number().int().positive().default(5000),

  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    // Logger isn't guaranteed to be usable yet (it may itself depend on
    // config), so this fails loudly and synchronously before anything
    // else in the app boots.
    console.error(`Invalid environment configuration:\n${formatted}`);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
