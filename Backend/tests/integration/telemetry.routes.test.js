import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/shared/messaging/kafkaClient.js', () => ({
  getProducer: vi.fn(),
  getProducerConnectionStatus: vi.fn().mockReturnValue('connected'),
}));

import { getProducer } from '../../src/shared/messaging/kafkaClient.js';
import { createApp } from '../../src/app.js';

const validPayload = {
  eventId: 'BIN001-000001',
  binId: 'BIN-001',
  fillLevel: 82,
  battery: 76,
  temperature: 31.5,
  latitude: 23.2599,
  longitude: 77.4126,
  timestamp: '2026-08-09T08:10:00Z',
};

describe('POST /api/v1/telemetry', () => {
  const app = createApp();
  let send;

  beforeEach(() => {
    send = vi.fn().mockResolvedValue([{ partition: 0, errorCode: 0 }]);
    getProducer.mockReturnValue({ send });
  });

  it('accepts valid telemetry, publishes to Kafka, and acknowledges with 202', async () => {
    const res = await request(app).post('/api/v1/telemetry').send(validPayload);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      status: 'accepted',
      eventId: validPayload.eventId,
      binId: validPayload.binId,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].messages[0].key).toBe(validPayload.binId);
    expect(JSON.parse(send.mock.calls[0][0].messages[0].value)).toEqual(validPayload);
  });

  it('rejects invalid telemetry with 400 and does not publish', async () => {
    const res = await request(app)
      .post('/api/v1/telemetry')
      .send({ ...validPayload, fillLevel: 150 });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects a payload missing required fields with 400', async () => {
    const { eventId, ...rest } = validPayload;
    const res = await request(app).post('/api/v1/telemetry').send(rest);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 503 when the Kafka publish fails, without leaking internals', async () => {
    send.mockRejectedValue(new Error('broker unreachable'));

    const res = await request(app).post('/api/v1/telemetry').send(validPayload);

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('publishes duplicate submissions again at the ingestion layer (dedup is a consumer concern)', async () => {
    await request(app).post('/api/v1/telemetry').send(validPayload);
    await request(app).post('/api/v1/telemetry').send(validPayload);

    // Ingestion never rejects a resend outright — the same eventId can
    // legitimately be retried by a device after a network hiccup.
    // Deduplication happens once, downstream, in the consumer via the
    // idempotency repository (see telemetry.consumer.test.js).
    expect(send).toHaveBeenCalledTimes(2);
  });
});
