import { describe, expect, it } from 'vitest';

import { CollectionTask } from '../../src/modules/tasks/collectionTask.model.js';

describe('CollectionTask model', () => {
  it('validates a well-formed task', () => {
    const task = new CollectionTask({
      binId: 'BIN-001',
      reason: 'fill level above threshold',
    });

    expect(task.validateSync()).toBeUndefined();
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('low');
  });

  it('requires binId and reason', () => {
    const task = new CollectionTask({});
    const err = task.validateSync();

    expect(err.errors['binId']).toBeDefined();
    expect(err.errors['reason']).toBeDefined();
  });

  it('rejects an unknown status value', () => {
    const task = new CollectionTask({
      binId: 'BIN-001',
      reason: 'overflow risk',
      status: 'not-a-real-status',
    });
    const err = task.validateSync();

    expect(err.errors['status']).toBeDefined();
  });
});
