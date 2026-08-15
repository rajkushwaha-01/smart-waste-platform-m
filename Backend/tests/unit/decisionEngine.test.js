import { describe, expect, it, vi } from 'vitest';

import {
  evaluateTelemetry,
  FULL_FILL_THRESHOLD,
  NEAR_FULL_FILL_THRESHOLD,
  LOW_BATTERY_THRESHOLD,
  HIGH_TEMPERATURE_THRESHOLD_CELSIUS,
  CRITICAL_FILL_THRESHOLD,
} from '../../src/modules/decision/decisionEngine.js';

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
    applyBinDecisionState: vi.fn().mockResolvedValue(undefined),
    createAlertRecord: vi.fn().mockResolvedValue(undefined),
    findOpenAlertRecord: vi.fn().mockResolvedValue(null),
    createTaskRecord: vi.fn().mockResolvedValue(undefined),
    findActiveTaskRecord: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('evaluateTelemetry — priority calculation', () => {
  it('classifies fillLevel < 60 as normal / low priority, no alerts or tasks', async () => {
    const deps = makeDeps();

    const result = await evaluateTelemetry({ event: baseEvent, prediction: null, bin: null, deps });

    expect(result).toMatchObject({
      fillStatus: 'normal',
      priority: 'low',
      maintenanceRequired: false,
      collectionRequired: false,
    });
    expect(deps.createAlertRecord).not.toHaveBeenCalled();
    expect(deps.createTaskRecord).not.toHaveBeenCalled();
  });

  it('classifies fillLevel >= 60 as near_full / medium priority, no collection task', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, fillLevel: NEAR_FULL_FILL_THRESHOLD };

    const result = await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(result.fillStatus).toBe('near_full');
    expect(result.priority).toBe('medium');
    expect(result.collectionRequired).toBe(false);
    expect(deps.createTaskRecord).not.toHaveBeenCalled();
  });

  it('classifies fillLevel >= 80 as full / high priority and requires collection', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, fillLevel: FULL_FILL_THRESHOLD };

    const result = await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(result.fillStatus).toBe('full');
    expect(result.priority).toBe('high');
    expect(result.collectionRequired).toBe(true);
    expect(deps.createTaskRecord).toHaveBeenCalledWith(
      expect.objectContaining({ binId: event.binId, priority: 'high' }),
    );
  });

  it('sets maintenanceRequired and raises a battery_low alert when battery < 20', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, battery: LOW_BATTERY_THRESHOLD - 1 };

    const result = await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(result.maintenanceRequired).toBe(true);
    expect(deps.createAlertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ binId: event.binId, type: 'battery_low' }),
    );
  });

  it('does not flag maintenance for battery at exactly the threshold', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, battery: LOW_BATTERY_THRESHOLD };

    const result = await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(result.maintenanceRequired).toBe(false);
  });

  it('raises a temperature_anomaly alert for high temperature', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, temperature: HIGH_TEMPERATURE_THRESHOLD_CELSIUS };

    await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(deps.createAlertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ binId: event.binId, type: 'temperature_anomaly' }),
    );
  });

  it('raises a critical_bin alert when fillLevel is at/above the critical threshold', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, fillLevel: CRITICAL_FILL_THRESHOLD };

    await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(deps.createAlertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ binId: event.binId, type: 'critical_bin' }),
    );
  });
});

describe('evaluateTelemetry — AI-enhanced decisions', () => {
  it('escalates a near_full reading to full/high priority when the AI predicts a strong overflow risk (worked example)', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, fillLevel: 72 };
    const prediction = { predictedFillLevel: 95, overflowProbability: 0.89 };

    const result = await evaluateTelemetry({ event, prediction, bin: null, deps });

    expect(result.fillStatus).toBe('full');
    expect(result.priority).toBe('high');
    expect(result.collectionRequired).toBe(true);
    expect(deps.createTaskRecord).toHaveBeenCalledWith(
      expect.objectContaining({ binId: event.binId, priority: 'high' }),
    );
    expect(deps.createAlertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ binId: event.binId, type: 'overflow' }),
    );
  });

  it('does not escalate on a weak AI signal (low overflowProbability)', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, fillLevel: 72 };
    const prediction = { predictedFillLevel: 95, overflowProbability: 0.3 };

    const result = await evaluateTelemetry({ event, prediction, bin: null, deps });

    expect(result.fillStatus).toBe('near_full');
    expect(result.collectionRequired).toBe(false);
    expect(deps.createTaskRecord).not.toHaveBeenCalled();
  });

  it('does not escalate when predictedFillLevel is below the AI full threshold, even with high probability', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, fillLevel: 72 };
    const prediction = { predictedFillLevel: 65, overflowProbability: 0.95 };

    const result = await evaluateTelemetry({ event, prediction, bin: null, deps });

    expect(result.fillStatus).toBe('near_full');
    expect(result.collectionRequired).toBe(false);
  });

  it('never downgrades a telemetry-full reading, regardless of prediction', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, fillLevel: 85 };
    const prediction = { predictedFillLevel: 10, overflowProbability: 0.01 };

    const result = await evaluateTelemetry({ event, prediction, bin: null, deps });

    expect(result.fillStatus).toBe('full');
    expect(result.priority).toBe('high');
  });

  it('degrades gracefully to telemetry-only thresholds when prediction is null', async () => {
    const deps = makeDeps();
    const event = { ...baseEvent, fillLevel: 72 };

    const result = await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(result.fillStatus).toBe('near_full');
    expect(result.priority).toBe('medium');
    expect(deps.createTaskRecord).not.toHaveBeenCalled();
  });
});

describe('evaluateTelemetry — duplicate prevention', () => {
  it('does not raise a second overflow alert when one is already open', async () => {
    const deps = makeDeps({
      findOpenAlertRecord: vi.fn().mockResolvedValue({ _id: 'existing-alert' }),
    });
    const event = { ...baseEvent, fillLevel: 72 };
    const prediction = { predictedFillLevel: 95, overflowProbability: 0.89 };

    await evaluateTelemetry({ event, prediction, bin: null, deps });

    expect(deps.createAlertRecord).not.toHaveBeenCalled();
  });

  it('does not create a second collection task when one is already active', async () => {
    const deps = makeDeps({
      findActiveTaskRecord: vi.fn().mockResolvedValue({ _id: 'existing-task' }),
    });
    const event = { ...baseEvent, fillLevel: FULL_FILL_THRESHOLD };

    await evaluateTelemetry({ event, prediction: null, bin: null, deps });

    expect(deps.createTaskRecord).not.toHaveBeenCalled();
  });

  it('skips the bin state write when nothing has changed since the last known bin state', async () => {
    const deps = makeDeps();
    const bin = {
      fillStatus: 'normal',
      priority: 'low',
      maintenanceRequired: false,
      collectionRequired: false,
    };

    const result = await evaluateTelemetry({ event: baseEvent, prediction: null, bin, deps });

    expect(deps.applyBinDecisionState).not.toHaveBeenCalled();
    expect(result.actions).not.toContain('bin_state_updated');
  });
});
