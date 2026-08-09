import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/tasks/collectionTask.model.js', async () => {
  const actual = await vi.importActual('../../src/modules/tasks/collectionTask.model.js');
  return {
    ...actual,
    CollectionTask: {
      create: vi.fn(),
      findOne: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      find: vi.fn(),
    },
  };
});

import { CollectionTask } from '../../src/modules/tasks/collectionTask.model.js';
import * as taskRepository from '../../src/modules/tasks/collectionTask.repository.js';

describe('collectionTask.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createTask creates a pending task', async () => {
    CollectionTask.create.mockResolvedValue({ binId: 'BIN-001', status: 'pending' });

    await taskRepository.createTask({ binId: 'BIN-001', priority: 'high', reason: 'overflow' });

    expect(CollectionTask.create).toHaveBeenCalledWith({
      binId: 'BIN-001',
      priority: 'high',
      reason: 'overflow',
      status: 'pending',
    });
  });

  it('findActiveTaskForBin only looks at active statuses', async () => {
    CollectionTask.findOne.mockResolvedValue(null);

    await taskRepository.findActiveTaskForBin('BIN-001');

    expect(CollectionTask.findOne).toHaveBeenCalledWith({
      binId: 'BIN-001',
      status: { $in: ['pending', 'assigned', 'in_progress'] },
    });
  });

  it('updateStatus stamps assignedAt when moving to assigned', async () => {
    CollectionTask.findByIdAndUpdate.mockResolvedValue({ status: 'assigned' });

    await taskRepository.updateStatus('task-1', 'assigned');

    const [, update] = CollectionTask.findByIdAndUpdate.mock.calls[0];
    expect(update.$set.status).toBe('assigned');
    expect(update.$set.assignedAt).toBeInstanceOf(Date);
    expect(update.$set.completedAt).toBeUndefined();
  });

  it('updateStatus stamps completedAt when moving to completed', async () => {
    CollectionTask.findByIdAndUpdate.mockResolvedValue({ status: 'completed' });

    await taskRepository.updateStatus('task-1', 'completed');

    const [, update] = CollectionTask.findByIdAndUpdate.mock.calls[0];
    expect(update.$set.completedAt).toBeInstanceOf(Date);
  });
});
