import axios from 'axios';

import { config } from '../../config/index.js';
import { logger } from '../../shared/logger/logger.js';

/**
 * Base class for every failure this client can produce. `isRetryable`
 * tells requestPrediction() whether it's worth trying again; callers
 * outside this file should only ever need to catch AiClientError,
 * never axios/HTTP specifics.
 */
export class AiClientError extends Error {
  constructor(message, { cause, statusCode, isRetryable = false, details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
    this.details = details;
  }
}

export class AiTimeoutError extends AiClientError {
  constructor(message = 'AI service request timed out', opts = {}) {
    super(message, { ...opts, isRetryable: true });
  }
}

export class AiNetworkError extends AiClientError {
  constructor(message = 'AI service unreachable', opts = {}) {
    super(message, { ...opts, isRetryable: true });
  }
}

/** 4xx — the request itself was rejected. Never retried: retrying an
 * invalid request just reproduces the same failure. */
export class AiRequestError extends AiClientError {
  constructor(message, opts = {}) {
    super(message, { ...opts, isRetryable: false });
  }
}

/** 5xx — the AI service itself failed. Worth a limited retry since
 * these are often transient. */
export class AiServerError extends AiClientError {
  constructor(message, opts = {}) {
    super(message, { ...opts, isRetryable: true });
  }
}

/** 2xx response, but the body doesn't look like a prediction. Not
 * retried: a broken response shape won't fix itself on retry. */
export class AiMalformedResponseError extends AiClientError {
  constructor(message, opts = {}) {
    super(message, { ...opts, isRetryable: false });
  }
}

let httpClientSingleton;

function getHttpClient() {
  if (!httpClientSingleton) {
    httpClientSingleton = axios.create({
      baseURL: config.aiService.baseUrl,
      timeout: config.aiService.timeoutMs,
      // Auth is optional (the real contract wasn't confirmed at
      // implementation time) and is never hardcoded — it's read from
      // AI_SERVICE_API_KEY at request-client construction time only.
      headers: config.aiService.apiKey
        ? { Authorization: `Bearer ${config.aiService.apiKey}` }
        : undefined,
    });
  }
  return httpClientSingleton;
}

function classifyError(err) {
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '')) {
    return new AiTimeoutError('AI service request timed out', { cause: err });
  }
  if (err.response) {
    const { status, data } = err.response;
    if (status >= 500) {
      return new AiServerError(`AI service returned ${status}`, {
        cause: err,
        statusCode: status,
        details: data,
      });
    }
    return new AiRequestError(`AI service rejected the request (${status})`, {
      cause: err,
      statusCode: status,
      details: data,
    });
  }
  if (err.request) {
    return new AiNetworkError('AI service unreachable', { cause: err });
  }
  return new AiClientError(err.message || 'Unknown AI client error', { cause: err });
}

/**
 * ASSUMED CONTRACT — the real AI API response shape was not provided.
 * This checks for the minimum fields the rest of the app currently
 * relies on (see ai.service.js); tighten/replace once the real
 * contract is confirmed.
 */
function validateResponseShape(data) {
  if (!data || typeof data !== 'object') {
    throw new AiMalformedResponseError('AI service returned a non-object response', {
      details: data,
    });
  }
  if (typeof data.overflowProbability !== 'number' || typeof data.predictedFillLevel !== 'number') {
    throw new AiMalformedResponseError(
      'AI service response is missing expected prediction fields',
      {
        details: data,
      },
    );
  }
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends one prediction request to the external AI service and
 * returns its (validated) raw response body.
 *
 * Retries transient failures (timeouts, network errors, 5xx) up to
 * `config.aiService.maxRetries` times with a linear backoff. 4xx
 * errors and malformed responses are never retried.
 *
 * This is the ONLY function in the codebase that knows the AI
 * service's URL path and wire format — everything else goes through
 * ai.service.js's predictBinTelemetry(), which maps to/from this.
 */
export async function requestPrediction(payload, { httpClient = getHttpClient() } = {}) {
  const maxAttempts = config.aiService.maxRetries + 1;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await httpClient.post(config.aiService.predictPath, payload);
      return validateResponseShape(response.data);
    } catch (err) {
      const classified = err instanceof AiClientError ? err : classifyError(err);
      lastError = classified;

      logger.warn(
        {
          err: classified,
          binId: payload?.binId,
          attempt,
          maxAttempts,
          retryable: classified.isRetryable,
        },
        'AI service prediction request failed',
      );

      if (!classified.isRetryable || attempt === maxAttempts) {
        throw classified;
      }

      await sleep(config.aiService.retryDelayMs * attempt);
    }
  }

  // Unreachable in practice (the loop always throws or returns above)
  // but keeps this function's control flow explicit for the linter.
  throw lastError;
}
