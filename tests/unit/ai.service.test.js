import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/ai/ai.client.js', () => ({
  requestPrediction: vi.fn(),
  AiClientError: class AiClientError extends Error {},
  AiTimeoutError: class AiTimeoutError extends Error {},
  AiNetworkError: class AiNetworkError extends Error {},
  AiRequestError: class AiRequestError extends Error {},
  AiServerError: class AiServerError extends Error {},
  AiMalformedResponseError: class AiMalformedResponseError extends Error {},
}));

import { requestPrediction } from '../../src/modules/ai/ai.client.js';
import { predictBinTelemetry } from '../../src/modules/ai/ai.service.js';

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

describe('predictBinTelemetry', () => {
  it('maps the telemetry event to the AI request shape', async () => {
    requestPrediction.mockResolvedValue({ predictedFillLevel: 90, overflowProbability: 0.6 });

    await predictBinTelemetry(event);

    expect(requestPrediction).toHaveBeenCalledWith({
      binId: event.binId,
      fillLevel: event.fillLevel,
      battery: event.battery,
      temperature: event.temperature,
      latitude: event.latitude,
      longitude: event.longitude,
      timestamp: event.timestamp,
    });
  });

  it('maps the AI response into the domain prediction shape', async () => {
    requestPrediction.mockResolvedValue({
      predictedFillLevel: 90,
      overflowProbability: 0.6,
      overflowEtaHours: 4,
      confidence: 0.95,
    });

    const result = await predictBinTelemetry(event);

    expect(result).toEqual({
      predictedFillLevel: 90,
      overflowProbability: 0.6,
      overflowEtaHours: 4,
      confidence: 0.95,
    });
  });

  it('defaults optional fields when the AI response omits them', async () => {
    requestPrediction.mockResolvedValue({ predictedFillLevel: 90, overflowProbability: 0.6 });

    const result = await predictBinTelemetry(event);

    expect(result.overflowEtaHours).toBeNull();
    expect(result.confidence).toBeNull();
  });

  it('propagates a failure from the underlying client', async () => {
    requestPrediction.mockRejectedValue(new Error('AI service down'));

    await expect(predictBinTelemetry(event)).rejects.toThrow('AI service down');
  });
});
