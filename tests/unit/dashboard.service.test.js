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

import * as binRepository from '../../src/modules/bins/bin.repository.js';
import * as alertRepository from '../../src/modules/alerts/alert.repository.js';
import * as taskRepository from '../../src/modules/tasks/collectionTask.repository.js';
import { getSummary } from '../../src/modules/dashboard/dashboard.service.js';

describe('dashboard.service.getSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps bin fillStatus counts, open alerts, and active tasks into the spec shape', async () => {
    binRepository.getSummaryStats.mockResolvedValue({
      totalBins: 10,
      normalBins: 5,
      nearFullBins: 3,
      fullBins: 2,
      averageFillLevel: 41.256,
    });
    alertRepository.countOpen.mockResolvedValue(4);
    taskRepository.countActive.mockResolvedValue(2);

    const summary = await getSummary();

    expect(summary).toEqual({
      totalBins: 10,
      normalBins: 5,
      nearFullBins: 3,
      criticalBins: 2,
      activeCollectionTasks: 2,
      activeAlerts: 4,
      averageFillLevel: 41.26,
    });
  });

  it('returns all zeros when there are no bins/alerts/tasks yet', async () => {
    binRepository.getSummaryStats.mockResolvedValue({
      totalBins: 0,
      normalBins: 0,
      nearFullBins: 0,
      fullBins: 0,
      averageFillLevel: 0,
    });
    alertRepository.countOpen.mockResolvedValue(0);
    taskRepository.countActive.mockResolvedValue(0);

    await expect(getSummary()).resolves.toEqual({
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
