import { describe, expect, it, vi } from 'vitest';

import { processTelemetryEvent } from '../../src/modules/telemetry/telemetry.consumer.js';

const event = {
  eventId: 'BIN001-000001',
  binId: 'BIN-001',
  fillLevel: 82,
  battery: 76,
  temperature: 31.5,
  latitude: 23.2599,
  longitude: 77.4126,
  timestamp: '2026-08-09T08:10:00Z',
};

const prediction = {
  predictedFillLevel: 88,
  overflowRiskScore: 0.42,
  overflowEtaHours: 6,
  confidence: 0.9,
};

const decision = { priority: 'high', actions: ['priority_updated'] };

function makeDeps(overrides = {}) {
  return {
    claim: vi.fn().mockResolvedValue(true),
    record: vi.fn().mockResolvedValue(undefined),
    upsertBin: vi.fn().mockResolvedValue({ binId: event.binId, priority: 'low' }),
    predict: vi.fn().mockResolvedValue(prediction),
    evaluate: vi.fn().mockResolvedValue(decision),
    timeseriesClient: {},
    ...overrides,
  };
}

describe('processTelemetryEvent', () => {
  it('runs the full pipeline for a new event: idempotency -> history -> bin state -> AI -> decision engine', async () => {
    const deps = makeDeps();

    const result = await processTelemetryEvent(event, deps);

    expect(deps.claim).toHaveBeenCalledWith(event.eventId, event.binId);
    expect(deps.record).toHaveBeenCalledWith(deps.timeseriesClient, event);
    expect(deps.upsertBin).toHaveBeenCalledWith(event.binId, {
      fillLevel: event.fillLevel,
      battery: event.battery,
      temperature: event.temperature,
      latitude: event.latitude,
      longitude: event.longitude,
      telemetryAt: new Date(event.timestamp),
    });
    expect(deps.predict).toHaveBeenCalledWith(event);
    expect(deps.evaluate).toHaveBeenCalledWith({
      event,
      prediction,
      bin: { binId: event.binId, priority: 'low' },
    });
    expect(result).toEqual({ processed: true, prediction, decision });
  });

  it('skips history/bin/AI/decision steps entirely for a duplicate eventId', async () => {
    const deps = makeDeps({ claim: vi.fn().mockResolvedValue(false) });

    const result = await processTelemetryEvent(event, deps);

    expect(deps.record).not.toHaveBeenCalled();
    expect(deps.upsertBin).not.toHaveBeenCalled();
    expect(deps.predict).not.toHaveBeenCalled();
    expect(deps.evaluate).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: false, reason: 'duplicate' });
  });

  it('propagates a history-write failure so the message is not committed', async () => {
    const deps = makeDeps({ record: vi.fn().mockRejectedValue(new Error('timeseries down')) });

    await expect(processTelemetryEvent(event, deps)).rejects.toThrow('timeseries down');
    expect(deps.upsertBin).not.toHaveBeenCalled();
    expect(deps.predict).not.toHaveBeenCalled();
  });

  it('propagates a bin-state update failure so the message is not committed', async () => {
    const deps = makeDeps({ upsertBin: vi.fn().mockRejectedValue(new Error('mongo down')) });

    await expect(processTelemetryEvent(event, deps)).rejects.toThrow('mongo down');
    expect(deps.predict).not.toHaveBeenCalled();
  });

  it('continues to the decision engine with prediction:null when the AI service fails', async () => {
    const deps = makeDeps({ predict: vi.fn().mockRejectedValue(new Error('AI service down')) });

    const result = await processTelemetryEvent(event, deps);

    expect(deps.evaluate).toHaveBeenCalledWith({
      event,
      prediction: null,
      bin: { binId: event.binId, priority: 'low' },
    });
    expect(result).toEqual({ processed: true, prediction: null, decision });
  });

  it('still completes (does not throw) when an AI timeout occurs', async () => {
    const timeoutError = Object.assign(new Error('AI service request timed out'), {
      name: 'AiTimeoutError',
    });
    const deps = makeDeps({ predict: vi.fn().mockRejectedValue(timeoutError) });

    await expect(processTelemetryEvent(event, deps)).resolves.toEqual({
      processed: true,
      prediction: null,
      decision,
    });
  });
});
