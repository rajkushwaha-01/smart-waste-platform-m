import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { config } from './config/index.js';
import { healthRouter } from './modules/health/health.routes.js';
import { telemetryRouter } from './modules/telemetry/telemetry.routes.js';
import { errorHandler } from './shared/middlewares/errorHandler.js';
import { notFoundHandler } from './shared/middlewares/notFoundHandler.js';
import { rateLimiter } from './shared/middlewares/rateLimiter.js';
import { requestId } from './shared/middlewares/requestId.js';
import { requestLogger } from './shared/middlewares/requestLogger.js';

export function createApp() {
  const app = express();

  // The app never trusts its own wall-clock notion of "the client's IP"
  // beyond what's needed for rate limiting behind a reverse proxy.
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(rateLimiter);

  app.use('/health', healthRouter);

  app.use('/api/v1/telemetry', telemetryRouter);

  // Business modules (bins, alerts, tasks, ai, routing) are mounted
  // here under /api/v1/* as they're implemented.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
