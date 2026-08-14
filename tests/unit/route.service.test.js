import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/route/route.client.js', async () => {
  const actual = await vi.importActual('../../src/modules/route/route.client.js');
  return { ...actual, requestRouteGeneration: vi.fn() };
});

import { requestRouteGeneration } from '../../src/modules/route/route.client.js';
import { generateRoute, RouteTimeoutError } from '../../src/modules/route/route.service.js';

const collectionTasks = [
  { taskId: 'task-1', binId: 'BIN-001', priority: 'high', latitude: 22.7, longitude: 75.8 },
  { taskId: 'task-2', binId: 'BIN-002', priority: 'medium', latitude: 22.8, longitude: 75.9 },
];

describe('generateRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps collection tasks to the request shape and the response back to domain shape', async () => {
    requestRouteGeneration.mockResolvedValue({
      routeId: 'route-1',
      stops: [
        { taskId: 'task-1', binId: 'BIN-001', sequence: 1, latitude: 22.7, longitude: 75.8 },
        { taskId: 'task-2', binId: 'BIN-002', sequence: 2 },
      ],
      totalDistanceKm: 15.4,
      estimatedDurationMinutes: 42,
    });

    const route = await generateRoute(collectionTasks);

    expect(requestRouteGeneration).toHaveBeenCalledWith({
      tasks: [
        { taskId: 'task-1', binId: 'BIN-001', latitude: 22.7, longitude: 75.8, priority: 'high' },
        { taskId: 'task-2', binId: 'BIN-002', latitude: 22.8, longitude: 75.9, priority: 'medium' },
      ],
    });
    expect(route.routeId).toBe('route-1');
    expect(route.totalDistanceKm).toBe(15.4);
    expect(route.stops[0]).toEqual({
      taskId: 'task-1',
      binId: 'BIN-001',
      sequence: 1,
      latitude: 22.7,
      longitude: 75.8,
      estimatedArrival: null,
    });
    // Fields the upstream response omitted default to null rather
    // than `undefined` leaking into the JSON response.
    expect(route.stops[1].latitude).toBeNull();
  });

  it('returns an empty route without calling the client when there are no tasks', async () => {
    const route = await generateRoute([]);

    expect(route).toEqual({
      routeId: null,
      stops: [],
      totalDistanceKm: 0,
      estimatedDurationMinutes: 0,
    });
    expect(requestRouteGeneration).not.toHaveBeenCalled();
  });

  it('propagates client errors unchanged', async () => {
    requestRouteGeneration.mockRejectedValue(new RouteTimeoutError());

    await expect(generateRoute(collectionTasks)).rejects.toBeInstanceOf(RouteTimeoutError);
  });
});
