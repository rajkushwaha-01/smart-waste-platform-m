import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/bins/bin.repository.js', () => ({
  list: vi.fn(),
  findByBinId: vi.fn(),
}));

vi.mock('../../src/modules/telemetry/telemetryHistory.repository.js', () => ({
  queryTelemetryHistory: vi.fn(),
}));

vi.mock('../../src/shared/database/timeseriesClient.js', () => ({
  getTimeseriesClient: vi.fn().mockReturnValue({}),
}));

vi.mock('../../src/shared/messaging/kafkaClient.js', () => ({
  getProducer: vi.fn(),
  getProducerConnectionStatus: vi.fn().mockReturnValue('connected'),
}));

import * as binRepository from '../../src/modules/bins/bin.repository.js';
import { queryTelemetryHistory } from '../../src/modules/telemetry/telemetryHistory.repository.js';
import { createApp } from '../../src/app.js';

const bin = { binId: 'BIN-001', currentFillLevel: 72, fillStatus: 'near_full' };

describe('bin routes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/bins', () => {
    it('returns the bin list', async () => {
      binRepository.list.mockResolvedValue([bin]);

      const res = await request(app).get('/api/v1/bins');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', count: 1, bins: [bin] });
    });

    it('passes status/priority query params through as filters', async () => {
      binRepository.list.mockResolvedValue([]);

      await request(app).get('/api/v1/bins').query({ status: 'active', priority: 'high' });

      expect(binRepository.list).toHaveBeenCalledWith({ status: 'active', priority: 'high' });
    });
  });

  describe('GET /api/v1/bins/:binId', () => {
    it('returns the bin when found', async () => {
      binRepository.findByBinId.mockResolvedValue(bin);

      const res = await request(app).get('/api/v1/bins/BIN-001');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', bin });
    });

    it('returns 404 for an unknown bin', async () => {
      binRepository.findByBinId.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/bins/BIN-404');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/bins/:binId/telemetry', () => {
    beforeEach(() => {
      binRepository.findByBinId.mockResolvedValue(bin);
    });

    it('returns historical telemetry from the time-series store', async () => {
      const points = [{ time: '2026-08-09T08:10:00Z', fillLevel: 82 }];
      queryTelemetryHistory.mockResolvedValue(points);

      const res = await request(app).get('/api/v1/bins/BIN-001/telemetry');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
        binId: 'BIN-001',
        count: 1,
        telemetry: points,
      });
    });

    it('applies from/to query filters', async () => {
      queryTelemetryHistory.mockResolvedValue([]);

      await request(app)
        .get('/api/v1/bins/BIN-001/telemetry')
        .query({ from: '2026-08-01T00:00:00Z', to: '2026-08-09T00:00:00Z' });

      const [, options] = queryTelemetryHistory.mock.calls[0];
      expect(options.from).toEqual(new Date('2026-08-01T00:00:00Z'));
      expect(options.to).toEqual(new Date('2026-08-09T00:00:00Z'));
    });

    it('returns 400 for an invalid "from" filter', async () => {
      const res = await request(app)
        .get('/api/v1/bins/BIN-001/telemetry')
        .query({ from: 'not-a-date' });

      expect(res.status).toBe(400);
      expect(queryTelemetryHistory).not.toHaveBeenCalled();
    });

    it('returns 404 when the bin does not exist, without querying the time-series store', async () => {
      binRepository.findByBinId.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/bins/BIN-404/telemetry');

      expect(res.status).toBe(404);
      expect(queryTelemetryHistory).not.toHaveBeenCalled();
    });
  });
});
