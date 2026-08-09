import { describe, expect, it } from 'vitest';

import { ProcessedEvent } from '../../src/modules/telemetry/processedEvent.model.js';

describe('ProcessedEvent model', () => {
  it('validates a well-formed event record', () => {
    const event = new ProcessedEvent({ eventId: 'evt-123', binId: 'BIN-001' });

    expect(event.validateSync()).toBeUndefined();
    expect(event.processedAt).toBeInstanceOf(Date);
  });

  it('requires eventId and binId', () => {
    const event = new ProcessedEvent({});
    const err = event.validateSync();

    expect(err.errors['eventId']).toBeDefined();
    expect(err.errors['binId']).toBeDefined();
  });
});
