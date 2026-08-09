import { describe, expect, it } from 'vitest';

import { AppError, NotFoundError, ValidationError } from '../../src/shared/errors/AppError.js';

describe('AppError', () => {
  it('defaults to a 500 internal error', () => {
    const err = new AppError('boom');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(true);
  });

  it('NotFoundError uses a 404 status', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('ValidationError uses a 400 status and carries details', () => {
    const err = new ValidationError('bad input', [{ path: 'foo' }]);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual([{ path: 'foo' }]);
  });
});
