import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/alerts/alert.repository.js', () => ({
  list: vi.fn(),
}));

vi.mock('../../src/shared/messaging/kafkaClient.js', () => ({
  getProducer: vi.fn(),
  getProducerConnectionStatus: vi.fn().mockReturnValue('connected'),
}));

import * as alertRepository from '../../src/modules/alerts/alert.repository.js';
import { createApp } from '../../src/app.js';

const alert = {
  _id: 'alert-1',
  binId: 'BIN-001',
  type: 'overflow',
  severity: 'critical',
  status: 'open',
};

describe('GET /api/v1/alerts', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the alert list', async () => {
    alertRepository.list.mockResolvedValue([alert]);

    const res = await request(app).get('/api/v1/alerts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', count: 1, alerts: [alert] });
  });

  it('passes status/severity query params through as filters', async () => {
    alertRepository.list.mockResolvedValue([]);

    await request(app).get('/api/v1/alerts').query({ status: 'open', severity: 'critical' });

    expect(alertRepository.list).toHaveBeenCalledWith({ status: 'open', severity: 'critical' });
  });

  it('returns an empty list when there are no alerts', async () => {
    alertRepository.list.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/alerts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', count: 0, alerts: [] });
  });
});
