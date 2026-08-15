import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

/**
 * Normalizes any Axios failure (network error, timeout, 4xx/5xx) into
 * a single shape the UI can render without knowing about Axios or
 * the backend's specific error envelope:
 *   { message, code, status, details }
 *
 * The backend's error responses look like:
 *   { status: 'error', error: { code, message, details? } }
 * (see shared/middlewares/errorHandler.js) — this unwraps that when
 * present, and falls back to a generic message for network-level
 * failures that never got a response at all.
 */
export function toApiError(err) {
  if (err.response) {
    const body = err.response.data;
    return {
      message: body?.error?.message ?? `Request failed with status ${err.response.status}`,
      code: body?.error?.code ?? 'UNKNOWN_ERROR',
      status: err.response.status,
      details: body?.error?.details,
    };
  }
  if (err.request) {
    return {
      message: 'Could not reach the backend. Is it running?',
      code: 'NETWORK_ERROR',
      status: null,
      details: undefined,
    };
  }
  return {
    message: err.message ?? 'Something went wrong',
    code: 'UNKNOWN_ERROR',
    status: null,
    details: undefined,
  };
}
