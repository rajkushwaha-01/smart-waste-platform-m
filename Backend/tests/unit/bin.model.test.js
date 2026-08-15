import { describe, expect, it } from 'vitest';

import { Bin } from '../../src/modules/bins/bin.model.js';

describe('Bin model', () => {
  it('validates a well-formed bin', () => {
    const bin = new Bin({
      binId: 'BIN-001',
      location: { latitude: 22.7196, longitude: 75.8577 },
      currentFillLevel: 42,
      battery: 88,
      temperature: 31.5,
    });

    expect(bin.validateSync()).toBeUndefined();
    expect(bin.status).toBe('active');
    expect(bin.priority).toBe('low');
    expect(bin.fillStatus).toBe('normal');
    expect(bin.maintenanceRequired).toBe(false);
    expect(bin.collectionRequired).toBe(false);
  });

  it('requires binId and location coordinates', () => {
    const bin = new Bin({});
    const err = bin.validateSync();

    expect(err).toBeDefined();
    expect(err.errors['binId']).toBeDefined();
    expect(err.errors['location.latitude']).toBeDefined();
    expect(err.errors['location.longitude']).toBeDefined();
  });

  it('rejects out-of-range coordinates', () => {
    const bin = new Bin({
      binId: 'BIN-002',
      location: { latitude: 200, longitude: -75.8577 },
    });
    const err = bin.validateSync();

    expect(err.errors['location.latitude']).toBeDefined();
  });

  it('rejects an unknown status value', () => {
    const bin = new Bin({
      binId: 'BIN-003',
      location: { latitude: 22.7, longitude: 75.8 },
      status: 'not-a-real-status',
    });
    const err = bin.validateSync();

    expect(err.errors['status']).toBeDefined();
  });
});
