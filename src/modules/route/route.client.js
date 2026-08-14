import axios from 'axios';

import { config } from '../../config/index.js';
import { logger } from '../../shared/logger/logger.js';

/**
 * ASSUMED CONTRACT — the real Route Optimization Service API details
 * (exact endpoint path, auth scheme, request/response shape) were
 * not provided; the task description left them as unfilled
 * placeholders. This mirrors the same "assumed contract, isolated in
 * one file" approach already used for the AI service (see
 * modules/ai/ai.client.js): everything below is a best-guess shape
 * for a route-optimization API, kept entirely inside this file and
 * route.service.js's two mapping functions. Once the real contract
 * is confirmed, only ROUTE_GENERATE_PATH below and the two mapping
 * functions in route.service.js need to change — no other module
 * (controller, collection service, etc.) depends on this shape.
 *
 * Assumed:
 *   METHOD: POST
 *   ENDPOINT: {ROUTE_SERVICE_URL}/api/v1/routes/generate
 *   AUTH: none (no API key env var was requested for this module)
 *   REQUEST:  { tasks: [{ taskId, binId, latitude, longitude, priority }] }
 *   RESPONSE: { routeId, stops: [{ taskId, binId, sequence, latitude,
 *               longitude, estimatedArrival }], totalDistanceKm,
 *               estimatedDurationMinutes }
 */
const ROUTE_GENERATE_PATH = '/api/v1/routes/generate';

/**
 * Base class for every failure this client can produce. Callers
 * outside this file should only ever need to catch RouteClientError
 * (or its subclasses) — never axios/HTTP specifics.
 */
export class RouteClientError extends Error {
  constructor(message, { cause, statusCode, details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class RouteTimeoutError extends RouteClientError {
  constructor(message = 'Route service request timed out', opts = {}) {
    super(message, opts);
  }
}

export class RouteNetworkError extends RouteClientError {
  constructor(message = 'Route service unreachable', opts = {}) {
    super(message, opts);
  }
}

/** 4xx — the request itself was rejected by the route service. */
export class RouteRequestError extends RouteClientError {
  constructor(message, opts = {}) {
    super(message, opts);
  }
}

/** 5xx — the route service itself failed. */
export class RouteServerError extends RouteClientError {
  constructor(message, opts = {}) {
    super(message, opts);
  }
}

/** 2xx response, but the body doesn't look like an optimized route. */
export class RouteMalformedResponseError extends RouteClientError {
  constructor(message, opts = {}) {
    super(message, opts);
  }
}

let httpClientSingleton;

function getHttpClient() {
  if (!httpClientSingleton) {
    httpClientSingleton = axios.create({
      baseURL: config.routeService.baseUrl,
      timeout: config.routeService.timeoutMs,
    });
  }
  return httpClientSingleton;
}

function classifyError(err) {
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '')) {
    return new RouteTimeoutError('Route service request timed out', { cause: err });
  }
  if (err.response) {
    const { status, data } = err.response;
    if (status >= 500) {
      return new RouteServerError(`Route service returned ${status}`, {
        cause: err,
        statusCode: status,
        details: data,
      });
    }
    return new RouteRequestError(`Route service rejected the request (${status})`, {
      cause: err,
      statusCode: status,
      details: data,
    });
  }
  if (err.request) {
    return new RouteNetworkError('Route service unreachable', { cause: err });
  }
  return new RouteClientError(err.message || 'Unknown route client error', { cause: err });
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * ASSUMED CONTRACT (see file header) — validates only the minimum
 * shape route.service.js's mapping actually relies on.
 */
function validateResponseShape(data) {
  if (!isPlainObject(data)) {
    throw new RouteMalformedResponseError('Route service returned a non-object response', {
      details: data,
    });
  }
  if (!Array.isArray(data.stops)) {
    throw new RouteMalformedResponseError('Route service response is missing a "stops" array', {
      details: data,
    });
  }
  const hasInvalidStop = data.stops.some(
    (stop) => !isPlainObject(stop) || typeof stop.binId !== 'string',
  );
  if (hasInvalidStop) {
    throw new RouteMalformedResponseError('Route service response contains a malformed stop', {
      details: data,
    });
  }
  return data;
}

/**
 * Sends one route-generation request to the external Route
 * Optimization Service and returns its (validated) raw response
 * body.
 *
 * No retries: this is called synchronously from a user-facing GET
 * request, so a single fast failure (translated into a typed error)
 * is preferable to adding latency by retrying — the caller decides
 * how to respond (e.g. 503) when this throws.
 *
 * This is the ONLY function in the codebase that knows the route
 * service's URL path and wire format — everything else goes through
 * route.service.js's generateRoute(), which maps to/from this.
 */
export async function requestRouteGeneration(payload, { httpClient = getHttpClient() } = {}) {
  try {
    const response = await httpClient.post(ROUTE_GENERATE_PATH, payload);
    return validateResponseShape(response.data);
  } catch (err) {
    const classified = err instanceof RouteClientError ? err : classifyError(err);
    logger.warn({ err: classified }, 'Route service request failed');
    throw classified;
  }
}
