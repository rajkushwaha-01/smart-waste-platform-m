import { describe, expect, it, vi } from 'vitest';

import { publishTelemetryEvent } from '../../src/modules/telemetry/telemetry.producer.js';
import { config } from '../../src/config/index.js';

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

describe('publishTelemetryEvent', () => {
  it('publishes to the configured telemetry topic, keyed by binId', async () => {
    const producer = { send: vi.fn().mockResolvedValue([{ partition: 0, errorCode: 0 }]) };

    await publishTelemetryEvent(producer, event);

    expect(producer.send).toHaveBeenCalledTimes(1);
    expect(producer.send).toHaveBeenCalledWith({
      topic: config.kafka.telemetryTopic,
      messages: [
        {
          key: event.binId,
          value: JSON.stringify(event),
          headers: { eventId: event.eventId },
        },
      ],
    });
  });

  it('resolves with the producer result on success', async () => {
    const sendResult = [{ partition: 0, errorCode: 0 }];
    const producer = { send: vi.fn().mockResolvedValue(sendResult) };

    const result = await publishTelemetryEvent(producer, event);

    expect(result).toBe(sendResult);
  });

  it('propagates and does not swallow a Kafka publish failure', async () => {
    const producer = { send: vi.fn().mockRejectedValue(new Error('broker unreachable')) };

    await expect(publishTelemetryEvent(producer, event)).rejects.toThrow('broker unreachable');
  });
});
