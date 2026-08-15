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
  overflowProbability: 0.42,
  overflowEtaHours: 6,
  confidence: 0.9,
};

const decision = { priority: 'high', actions: ['priority_updated'] };

function makeDeps(overrides = {}) {
  return {
    isProcessed: vi.fn().mockResolvedValue(false),
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
  it('runs the full pipeline for a new event: idempotency check -> history -> bin state -> AI -> decision engine -> claim', async () => {
    const deps = makeDeps();
    const callOrder = [];
    for (const name of ['isProcessed', 'record', 'upsertBin', 'predict', 'evaluate', 'claim']) {
      const original = deps[name];
      deps[name] = vi.fn((...args) => {
        callOrder.push(name);
        return original(...args);
      });
    }

    const result = await processTelemetryEvent(event, deps);

    expect(deps.isProcessed).toHaveBeenCalledWith(event.eventId);
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
    expect(deps.claim).toHaveBeenCalledWith(event.eventId, event.binId);
    // The claim MUST be last: it's what makes redelivery-after-a-
    // partial-failure retry correctly instead of silently dropping
    // the reading (see the module doc comment / regression tests
    // below for the failure mode this ordering prevents).
    expect(callOrder).toEqual(['isProcessed', 'record', 'upsertBin', 'predict', 'evaluate', 'claim']);
    expect(result).toEqual({ processed: true, prediction, decision });
  });

  it('skips all processing for an already-processed eventId, without re-claiming it', async () => {
    const deps = makeDeps({ isProcessed: vi.fn().mockResolvedValue(true) });

    const result = await processTelemetryEvent(event, deps);

    expect(deps.record).not.toHaveBeenCalled();
    expect(deps.upsertBin).not.toHaveBeenCalled();
    expect(deps.predict).not.toHaveBeenCalled();
    expect(deps.evaluate).not.toHaveBeenCalled();
    expect(deps.claim).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: false, reason: 'duplicate' });
  });

  it('propagates a history-write failure so the message is not committed, and never claims the eventId', async () => {
    const deps = makeDeps({ record: vi.fn().mockRejectedValue(new Error('timeseries down')) });

    await expect(processTelemetryEvent(event, deps)).rejects.toThrow('timeseries down');
    expect(deps.upsertBin).not.toHaveBeenCalled();
    expect(deps.predict).not.toHaveBeenCalled();
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it('propagates a bin-state update failure so the message is not committed, and never claims the eventId', async () => {
    const deps = makeDeps({ upsertBin: vi.fn().mockRejectedValue(new Error('mongo down')) });

    await expect(processTelemetryEvent(event, deps)).rejects.toThrow('mongo down');
    expect(deps.predict).not.toHaveBeenCalled();
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it('propagates a decision-engine failure and never claims the eventId (regression: a transient failure must not permanently mark the event as processed)', async () => {
    const deps = makeDeps({ evaluate: vi.fn().mockRejectedValue(new Error('mongo write conflict')) });

    await expect(processTelemetryEvent(event, deps)).rejects.toThrow('mongo write conflict');
    // This is the crux of the fix: if claim() had already run before
    // this failure, a Kafka-redelivered retry of the exact same
    // eventId would see it as "already processed" and skip it
    // forever, silently losing a reading that never actually made it
    // through the pipeline. Not claiming here is what makes the
    // retry safe.
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it('continues to the decision engine with prediction:null when the AI service fails, and still claims the eventId', async () => {
    const deps = makeDeps({ predict: vi.fn().mockRejectedValue(new Error('AI service down')) });

    const result = await processTelemetryEvent(event, deps);

    expect(deps.evaluate).toHaveBeenCalledWith({
      event,
      prediction: null,
      bin: { binId: event.binId, priority: 'low' },
    });
    expect(deps.claim).toHaveBeenCalledWith(event.eventId, event.binId);
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

  it('treats a rare concurrent-claim race (claim returns false) as a harmless success, not an error', async () => {
    const deps = makeDeps({ claim: vi.fn().mockResolvedValue(false) });

    await expect(processTelemetryEvent(event, deps)).resolves.toEqual({
      processed: true,
      prediction,
      decision,
    });
  });
});
