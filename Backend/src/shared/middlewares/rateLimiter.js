import { rateLimit } from 'express-rate-limit';

/**
 * General-purpose API rate limiter. Kept deliberately generic here —
 * per-route overrides (e.g. a stricter limit on telemetry ingestion)
 * belong in the module that owns that route, applied on top of this.
 */
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.',
    },
  },
});
