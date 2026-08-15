import { randomUUID } from 'node:crypto';

/**
 * Attaches a request id (from an inbound header, if present, so it can
 * be propagated across services — or freshly generated) to `req` and
 * echoes it back on the response for client-side correlation.
 */
export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && incoming.trim() !== '' ? incoming : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
