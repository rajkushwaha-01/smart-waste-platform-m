import { describe, expect, it, vi } from 'vitest';

import { recordTelemetry } from '../../src/modules/telemetry/telemetryHistory.repository.js';

describe('telemetryHistory.repository', () => {
  it('writes a "telemetry" point with the expected tags and fields', async () => {
    const fakeClient = { writePoint: vi.fn().mockResolvedValue(undefined) };

    await recordTelemetry(fakeClient, {
      eventId: 'evt-1',
      binId: 'BIN-001',
      fillLevel: 88,
      battery: 45,
      temperature: 30.2,
      latitude: 22.7,
      longitude: 75.8,
      timestamp: 1_700_000_000_000,
    });

    expect(fakeClient.writePoint).toHaveBeenCalledWith('telemetry', {
      tags: { binId: 'BIN-001' },
      fields: {
        eventId: 'evt-1',
        fillLevel: 88,
        battery: 45,
        temperature: 30.2,
        latitude: 22.7,
        longitude: 75.8,
      },
      timestamp: 1_700_000_000_000,
    });
  });

  it('defaults timestamp to now when not provided', async () => {
    const fakeClient = { writePoint: vi.fn().mockResolvedValue(undefined) };
    const before = Date.now();

    await recordTelemetry(fakeClient, {
      eventId: 'evt-2',
      binId: 'BIN-002',
      fillLevel: 10,
      battery: 90,
      temperature: 25,
      latitude: 0,
      longitude: 0,
    });

    const [, point] = fakeClient.writePoint.mock.calls[0];
    expect(point.timestamp).toBeGreaterThanOrEqual(before);
  });
});
