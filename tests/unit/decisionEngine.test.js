import { describe, expect, it, vi } from 'vitest';

import { evaluateTelemetry } from '../../src/modules/decision/decisionEngine.js';

const baseEvent = {
  eventId: 'BIN001-000001',
  binId: 'BIN-001',
  fillLevel: 40,
  battery: 76,
  temperature: 31.5,
  latitude: 23.2599,
  longitude: 77.4126,
  timestamp: '2026-08-09T08:10:00Z',
};

function makeDeps(overrides = {}) {
  return {
    updateBinPriority: vi.fn().mockResolvedValue(undefined),
    createAlertRecord: vi.fn().mockResolvedValue(undefined),
    findOpenAlertRecord: vi.fn().mockResolvedValue(null),
    createTaskRecord: vi.fn().mockResolvedValue(undefined),
    findActiveTaskRecord: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('evaluateTelemetry', () => {
  it('assigns low priority and raises no alerts for a routine reading', async () => {
    const deps = makeDeps();

    const result = await evaluateTelemetry({ event: baseEvent, prediction: null, bin: null, deps });

    expect(result.priority).toBe('low');
    expect(deps.createAlertRecord).not.toHaveBeenCalled();
    expect(deps.createTaskRecord).not.toHaveBeenCalled();
  });

  it('escalates to critical and raises an overflow alert + task when fillLevel crosses the threshold', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, fillLevel: 95 };

    const result = await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(result.priority).toBe('critical');
    expect(deps.createAlertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ binId: event.binId, type: 'overflow' }),
    );
    expect(deps.createTaskRecord).toHaveBeenCalledWith(
      expect.objectContaining({ binId: event.binId, priority: 'critical' }),
    );
  });

  it('escalates to critical from a high AI overflow risk score even with moderate fillLevel', async () => {
    const deps = makeDeps();
    const prediction = { overflowRiskScore: 0.85 };

    const result = await evaluateTelemetry({ event: baseEvent, prediction, bin: null, deps });

    expect(result.priority).toBe('critical');
    expect(deps.createAlertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'overflow' }),
    );
  });

  it('does not raise a second overflow alert when one is already open', async () => {
    const deps = makeDeps({
      findOpenAlertRecord: vi.fn().mockResolvedValue({ _id: 'existing-alert' }),
    });
    const event = { ...baseEvent, fillLevel: 95 };

    await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(deps.createAlertRecord).not.toHaveBeenCalled();
  });

  it('does not create a second collection task when one is already active', async () => {
    const deps = makeDeps({
      findActiveTaskRecord: vi.fn().mockResolvedValue({ _id: 'existing-task' }),
    });
    const event = { ...baseEvent, fillLevel: 95 };

    await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(deps.createTaskRecord).not.toHaveBeenCalled();
  });

  it('raises a battery_low alert when battery is at or below the threshold', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, battery: 10 };

    await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(deps.createAlertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ binId: event.binId, type: 'battery_low' }),
    );
  });

  it('skips the bin priority update when the bin already has the derived priority', async () => {
    const deps = makeDeps();
    const bin = { binId: baseEvent.binId, priority: 'low' };

    await evaluateTelemetry({ event: baseEvent, prediction: null, bin, deps });

    expect(deps.updateBinPriority).not.toHaveBeenCalled();
  });
});
