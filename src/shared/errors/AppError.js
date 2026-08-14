/**
 * Base class for errors that are expected/operational (bad input, not
 * found, upstream failure, etc.) as opposed to programmer errors/bugs.
 * The centralized error handler uses `isOperational` to decide what is
 * safe to expose to the client.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, { code = 'INTERNAL_ERROR', details = undefined } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, { code: 'NOT_FOUND' });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request', details = undefined) {
    super(message, 400, { code: 'VALIDATION_ERROR', details });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', details = undefined) {
    super(message, 503, { code: 'SERVICE_UNAVAILABLE', details });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Request conflicts with the current state', details = undefined) {
    super(message, 409, { code: 'CONFLICT', details });
  }
}
