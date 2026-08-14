import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/bins/bin.repository.js', () => ({
  getSummaryStats: vi.fn(),
}));
vi.mock('../../src/modules/alerts/alert.repository.js', () => ({
  countOpen: vi.fn(),
}));
vi.mock('../../src/modules/tasks/collectionTask.repository.js', () => ({
  countActive: vi.fn(),
}));

vi.mock('../../src/shared/messaging/kafkaClient.js', () => ({
  getProducer: vi.fn(),
  getProducerConnectionStatus: vi.fn().mockReturnValue('connected'),
}));

import * as binRepository from '../../src/modules/bins/bin.repository.js';
import * as alertRepository from '../../src/modules/alerts/alert.repository.js';
import * as taskRepository from '../../src/modules/tasks/collectionTask.repository.js';
import { createApp } from '../../src/app.js';

describe('GET /api/v1/dashboard/summary', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the summary in the exact shape from the spec, with no envelope', async () => {
    binRepository.getSummaryStats.mockResolvedValue({
      totalBins: 10,
      normalBins: 5,
      nearFullBins: 3,
      fullBins: 2,
      averageFillLevel: 38.4,
    });
    alertRepository.countOpen.mockResolvedValue(1);
    taskRepository.countActive.mockResolvedValue(2);

    const res = await request(app).get('/api/v1/dashboard/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalBins: 10,
      normalBins: 5,
      nearFullBins: 3,
      criticalBins: 2,
      activeCollectionTasks: 2,
      activeAlerts: 1,
      averageFillLevel: 38.4,
    });
  });

  it('returns an all-zero summary on an empty system', async () => {
    binRepository.getSummaryStats.mockResolvedValue({
      totalBins: 0,
      normalBins: 0,
      nearFullBins: 0,
      fullBins: 0,
      averageFillLevel: 0,
    });
    alertRepository.countOpen.mockResolvedValue(0);
    taskRepository.countActive.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/dashboard/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalBins: 0,
      normalBins: 0,
      nearFullBins: 0,
      criticalBins: 0,
      activeCollectionTasks: 0,
      activeAlerts: 0,
      averageFillLevel: 0,
    });
  });
});
