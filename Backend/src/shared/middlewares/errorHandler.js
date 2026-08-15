import { ZodError } from 'zod';

import { config } from '../../config/index.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../logger/logger.js';

/**
 * Normalizes any thrown/forwarded error into a consistent operational
 * shape: { statusCode, code, message, details, isOperational }.
 */
function normalizeError(err) {
  if (err instanceof AppError) {
    return err;
  }

  if (err instanceof ZodError) {
    return new AppError('Invalid request', 400, {
      code: 'VALIDATION_ERROR',
      details: err.issues,
    });
  }

  // Unrecognized/programmer errors — not safe to expose details for.
  const normalized = new AppError(err.message || 'Internal server error', 500, {
    code: 'INTERNAL_ERROR',
  });
  normalized.isOperational = false;
  normalized.stack = err.stack;
  return normalized;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);

  const logPayload = {
    reqId: req.id,
    statusCode: normalized.statusCode,
    code: normalized.code,
    err: normalized,
  };

  if (normalized.isOperational) {
    logger.warn(logPayload, normalized.message);
  } else {
    logger.error(logPayload, normalized.message);
  }

  const body = {
    status: 'error',
    error: {
      code: normalized.code,
      // In production, never leak internal error messages for
      // non-operational (unexpected) failures.
      message:
        normalized.isOperational || !config.isProduction
          ? normalized.message
          : 'Something went wrong. Please try again later.',
    },
  };

  if (normalized.details !== undefined) {
    body.error.details = normalized.details;
  }

  if (!config.isProduction && normalized.stack) {
    body.error.stack = normalized.stack;
  }

  res.status(normalized.statusCode).json(body);
}
