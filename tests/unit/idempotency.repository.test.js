import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/telemetry/processedEvent.model.js', () => ({
  ProcessedEvent: {
    create: vi.fn(),
    findOne: vi.fn(),
  },
}));

import { ProcessedEvent } from '../../src/modules/telemetry/processedEvent.model.js';
import {
  claimEvent,
  isEventProcessed,
} from '../../src/modules/telemetry/idempotency.repository.js';

describe('idempotency.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claimEvent returns true for a brand-new eventId', async () => {
    ProcessedEvent.create.mockResolvedValue({ eventId: 'evt-1', binId: 'BIN-001' });

    const claimed = await claimEvent('evt-1', 'BIN-001');

    expect(claimed).toBe(true);
    expect(ProcessedEvent.create).toHaveBeenCalledWith({ eventId: 'evt-1', binId: 'BIN-001' });
  });

  it('claimEvent returns false when the eventId already exists (duplicate key)', async () => {
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    ProcessedEvent.create.mockRejectedValue(duplicateKeyError);

    const claimed = await claimEvent('evt-1', 'BIN-001');

    expect(claimed).toBe(false);
  });

  it('claimEvent rethrows unrelated errors', async () => {
    ProcessedEvent.create.mockRejectedValue(new Error('connection lost'));

    await expect(claimEvent('evt-1', 'BIN-001')).rejects.toThrow('connection lost');
  });

  it('isEventProcessed reflects whether a record exists', async () => {
    ProcessedEvent.findOne.mockReturnValue({ lean: () => Promise.resolve({ eventId: 'evt-1' }) });

    const processed = await isEventProcessed('evt-1');

    expect(processed).toBe(true);
    expect(ProcessedEvent.findOne).toHaveBeenCalledWith({ eventId: 'evt-1' });
  });
});
