import { describe, expect, it, vi } from 'vitest';

import {
  requestRouteGeneration,
  RouteTimeoutError,
  RouteNetworkError,
  RouteRequestError,
  RouteServerError,
  RouteMalformedResponseError,
} from '../../src/modules/route/route.client.js';

const payload = {
  tasks: [
    { taskId: 'task-1', binId: 'BIN-001', latitude: 22.7, longitude: 75.8, priority: 'high' },
  ],
};

function axiosErrorWithResponse(status, data = {}) {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status, data };
  return err;
}

function axiosNetworkError() {
  const err = new Error('connect ECONNREFUSED');
  err.request = {};
  return err;
}

function axiosTimeoutError() {
  const err = new Error('timeout of 5000ms exceeded');
  err.code = 'ECONNABORTED';
  return err;
}

describe('requestRouteGeneration', () => {
  it('posts the payload and returns the validated response on success', async () => {
    const responseBody = {
      routeId: 'route-1',
      stops: [{ taskId: 'task-1', binId: 'BIN-001', sequence: 1 }],
      totalDistanceKm: 8.2,
      estimatedDurationMinutes: 25,
    };
    const httpClient = { post: vi.fn().mockResolvedValue({ data: responseBody }) };

    const result = await requestRouteGeneration(payload, { httpClient });

    expect(httpClient.post).toHaveBeenCalledWith('/api/v1/routes/generate', payload);
    expect(result).toEqual(responseBody);
  });

  it('throws RouteTimeoutError on a timeout, without retrying', async () => {
    const httpClient = { post: vi.fn().mockRejectedValue(axiosTimeoutError()) };

    await expect(requestRouteGeneration(payload, { httpClient })).rejects.toBeInstanceOf(
      RouteTimeoutError,
    );
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('throws RouteNetworkError when the request never reaches the server', async () => {
    const httpClient = { post: vi.fn().mockRejectedValue(axiosNetworkError()) };

    await expect(requestRouteGeneration(payload, { httpClient })).rejects.toBeInstanceOf(
      RouteNetworkError,
    );
  });

  it('throws RouteRequestError on a 4xx response', async () => {
    const httpClient = {
      post: vi.fn().mockRejectedValue(axiosErrorWithResponse(422, { message: 'bad payload' })),
    };

    const error = await requestRouteGeneration(payload, { httpClient }).catch((err) => err);

    expect(error).toBeInstanceOf(RouteRequestError);
    expect(error.statusCode).toBe(422);
  });

  it('throws RouteServerError on a 5xx response', async () => {
    const httpClient = { post: vi.fn().mockRejectedValue(axiosErrorWithResponse(503)) };

    const error = await requestRouteGeneration(payload, { httpClient }).catch((err) => err);

    expect(error).toBeInstanceOf(RouteServerError);
    expect(error.statusCode).toBe(503);
  });

  it('throws RouteMalformedResponseError when "stops" is missing', async () => {
    const httpClient = { post: vi.fn().mockResolvedValue({ data: { routeId: 'route-1' } }) };

    await expect(requestRouteGeneration(payload, { httpClient })).rejects.toBeInstanceOf(
      RouteMalformedResponseError,
    );
  });

  it('throws RouteMalformedResponseError for a null/non-object response body', async () => {
    const httpClient = { post: vi.fn().mockResolvedValue({ data: null }) };

    await expect(requestRouteGeneration(payload, { httpClient })).rejects.toBeInstanceOf(
      RouteMalformedResponseError,
    );
  });

  it('throws RouteMalformedResponseError when a stop is missing binId', async () => {
    const httpClient = {
      post: vi.fn().mockResolvedValue({ data: { stops: [{ sequence: 1 }] } }),
    };

    await expect(requestRouteGeneration(payload, { httpClient })).rejects.toBeInstanceOf(
      RouteMalformedResponseError,
    );
  });
});
