/**
 * Wraps an async Express route handler so rejected promises are
 * forwarded to `next(err)` instead of crashing the process or hanging
 * the request.
 */
export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
