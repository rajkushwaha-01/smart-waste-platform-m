import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/tasks/collectionTask.repository.js', () => ({
  listQueue: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock('../../src/modules/bins/bin.repository.js', () => ({
  findManyByBinIds: vi.fn(),
}));

vi.mock('../../src/modules/route/route.service.js', async () => {
  const actual = await vi.importActual('../../src/modules/route/route.service.js');
  return { ...actual, generateRoute: vi.fn() };
});

vi.mock('../../src/shared/messaging/kafkaClient.js', () => ({
  getProducer: vi.fn(),
  getProducerConnectionStatus: vi.fn().mockReturnValue('connected'),
}));

import * as binRepository from '../../src/modules/bins/bin.repository.js';
import { generateRoute, RouteTimeoutError } from '../../src/modules/route/route.service.js';
import * as taskRepository from '../../src/modules/tasks/collectionTask.repository.js';
import { createApp } from '../../src/app.js';

describe('collection routes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/collection/queue', () => {
    it('returns the active queue ordered by priority', async () => {
      const queue = [
        { _id: 'task-1', binId: 'BIN-001', priority: 'high', status: 'pending' },
        { _id: 'task-2', binId: 'BIN-002', priority: 'medium', status: 'pending' },
      ];
      taskRepository.listQueue.mockResolvedValue(queue);

      const res = await request(app).get('/api/v1/collection/queue');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', count: 2, tasks: queue });
    });
  });

  describe('GET /api/v1/collection/route', () => {
    it('resolves task locations and returns the generated route', async () => {
      const queue = [
        { _id: 'task-1', binId: 'BIN-001', priority: 'high', status: 'pending' },
        { _id: 'task-2', binId: 'BIN-002', priority: 'medium', status: 'pending' },
      ];
      taskRepository.listQueue.mockResolvedValue(queue);
      binRepository.findManyByBinIds.mockResolvedValue([
        { binId: 'BIN-001', location: { latitude: 22.7, longitude: 75.8 } },
        { binId: 'BIN-002', location: { latitude: 22.8, longitude: 75.9 } },
      ]);
      const route = {
        routeId: 'route-1',
        stops: [{ taskId: 'task-1', binId: 'BIN-001', sequence: 1 }],
        totalDistanceKm: 12.3,
        estimatedDurationMinutes: 40,
      };
      generateRoute.mockResolvedValue(route);

      const res = await request(app).get('/api/v1/collection/route');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', route });
      expect(generateRoute).toHaveBeenCalledWith([
        { taskId: 'task-1', binId: 'BIN-001', priority: 'high', latitude: 22.7, longitude: 75.8 },
        { taskId: 'task-2', binId: 'BIN-002', priority: 'medium', latitude: 22.8, longitude: 75.9 },
      ]);
    });

    it('returns an empty route without calling the route service when the queue is empty', async () => {
      taskRepository.listQueue.mockResolvedValue([]);

      const res = await request(app).get('/api/v1/collection/route');

      expect(res.status).toBe(200);
      expect(res.body.route).toEqual({
        routeId: null,
        stops: [],
        totalDistanceKm: 0,
        estimatedDurationMinutes: 0,
      });
      expect(generateRoute).not.toHaveBeenCalled();
    });

    it('returns 503, not a crash, when the route service is unavailable', async () => {
      taskRepository.listQueue.mockResolvedValue([
        { _id: 'task-1', binId: 'BIN-001', priority: 'high', status: 'pending' },
      ]);
      binRepository.findManyByBinIds.mockResolvedValue([
        { binId: 'BIN-001', location: { latitude: 22.7, longitude: 75.8 } },
      ]);
      generateRoute.mockRejectedValue(new RouteTimeoutError());

      const res = await request(app).get('/api/v1/collection/route');

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('POST /api/v1/collection/tasks/:taskId/assign', () => {
    it('assigns a pending task', async () => {
      taskRepository.findById.mockResolvedValue({ _id: 'task-1', status: 'pending' });
      taskRepository.updateStatus.mockResolvedValue({ _id: 'task-1', status: 'assigned' });

      const res = await request(app).post('/api/v1/collection/tasks/task-1/assign');

      expect(res.status).toBe(200);
      expect(res.body.task).toEqual({ _id: 'task-1', status: 'assigned' });
      expect(taskRepository.updateStatus).toHaveBeenCalledWith('task-1', 'assigned');
    });

    it('returns 404 for an unknown task', async () => {
      taskRepository.findById.mockResolvedValue(null);

      const res = await request(app).post('/api/v1/collection/tasks/does-not-exist/assign');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 409 when the task is not pending', async () => {
      taskRepository.findById.mockResolvedValue({ _id: 'task-1', status: 'assigned' });

      const res = await request(app).post('/api/v1/collection/tasks/task-1/assign');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(taskRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/collection/tasks/:taskId/complete', () => {
    it('completes an assigned task', async () => {
      taskRepository.findById.mockResolvedValue({ _id: 'task-1', status: 'assigned' });
      taskRepository.updateStatus.mockResolvedValue({ _id: 'task-1', status: 'completed' });

      const res = await request(app).post('/api/v1/collection/tasks/task-1/complete');

      expect(res.status).toBe(200);
      expect(res.body.task).toEqual({ _id: 'task-1', status: 'completed' });
      expect(taskRepository.updateStatus).toHaveBeenCalledWith('task-1', 'completed');
    });

    it('completes an in_progress task', async () => {
      taskRepository.findById.mockResolvedValue({ _id: 'task-1', status: 'in_progress' });
      taskRepository.updateStatus.mockResolvedValue({ _id: 'task-1', status: 'completed' });

      const res = await request(app).post('/api/v1/collection/tasks/task-1/complete');

      expect(res.status).toBe(200);
    });

    it('returns 409 when completing a task that is still pending', async () => {
      taskRepository.findById.mockResolvedValue({ _id: 'task-1', status: 'pending' });

      const res = await request(app).post('/api/v1/collection/tasks/task-1/complete');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 404 for an unknown task', async () => {
      taskRepository.findById.mockResolvedValue(null);

      const res = await request(app).post('/api/v1/collection/tasks/does-not-exist/complete');

      expect(res.status).toBe(404);
    });

    it('returns 404 for a malformed task id (CastError)', async () => {
      const castError = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' });
      taskRepository.findById.mockRejectedValue(castError);

      const res = await request(app).post('/api/v1/collection/tasks/not-an-id/complete');

      expect(res.status).toBe(404);
    });
  });
});
