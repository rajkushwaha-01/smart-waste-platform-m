import { describe, expect, it } from 'vitest';

import { Alert } from '../../src/modules/alerts/alert.model.js';

describe('Alert model', () => {
  it('validates a well-formed alert', () => {
    const alert = new Alert({
      binId: 'BIN-001',
      type: 'overflow',
      message: 'Fill level exceeded 95%',
    });

    expect(alert.validateSync()).toBeUndefined();
    expect(alert.severity).toBe('medium');
    expect(alert.status).toBe('open');
  });

  it('requires binId, type, and message', () => {
    const alert = new Alert({});
    const err = alert.validateSync();

    expect(err.errors['binId']).toBeDefined();
    expect(err.errors['type']).toBeDefined();
    expect(err.errors['message']).toBeDefined();
  });

  it('rejects an unknown alert type', () => {
    const alert = new Alert({
      binId: 'BIN-001',
      type: 'not-a-real-type',
      message: 'test',
    });
    const err = alert.validateSync();

    expect(err.errors['type']).toBeDefined();
  });
});
