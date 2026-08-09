import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/alerts/alert.model.js', () => ({
  Alert: {
    create: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
  },
}));

import { Alert } from '../../src/modules/alerts/alert.model.js';
import * as alertRepository from '../../src/modules/alerts/alert.repository.js';

describe('alert.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createAlert creates an open alert', async () => {
    Alert.create.mockResolvedValue({ binId: 'BIN-001', status: 'open' });

    await alertRepository.createAlert({
      binId: 'BIN-001',
      type: 'overflow',
      severity: 'high',
      message: 'Fill level critical',
    });

    expect(Alert.create).toHaveBeenCalledWith({
      binId: 'BIN-001',
      type: 'overflow',
      severity: 'high',
      message: 'Fill level critical',
      status: 'open',
    });
  });

  it('findOpenAlert filters by binId, type, and open status', async () => {
    Alert.findOne.mockResolvedValue(null);

    await alertRepository.findOpenAlert('BIN-001', 'overflow');

    expect(Alert.findOne).toHaveBeenCalledWith({
      binId: 'BIN-001',
      type: 'overflow',
      status: 'open',
    });
  });

  it('resolveAlert sets status to resolved', async () => {
    Alert.findByIdAndUpdate.mockResolvedValue({ status: 'resolved' });

    await alertRepository.resolveAlert('alert-1');

    expect(Alert.findByIdAndUpdate).toHaveBeenCalledWith(
      'alert-1',
      { $set: { status: 'resolved' } },
      { new: true },
    );
  });
});
