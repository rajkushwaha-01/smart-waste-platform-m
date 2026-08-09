import { describe, expect, it } from 'vitest';

import { telemetrySchema } from '../../src/modules/telemetry/telemetry.schema.js';

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

describe('telemetrySchema', () => {
  it('accepts a valid telemetry payload', () => {
    const result = telemetrySchema.parse(validPayload);
    expect(result).toEqual(validPayload);
  });

  it('rejects a payload missing eventId', () => {
    const { eventId, ...rest } = validPayload;
    expect(() => telemetrySchema.parse(rest)).toThrow();
  });

  it('rejects a payload missing binId', () => {
    const { binId, ...rest } = validPayload;
    expect(() => telemetrySchema.parse(rest)).toThrow();
  });

  it.each([-1, 101])('rejects fillLevel out of 0-100 range (%s)', (fillLevel) => {
    expect(() => telemetrySchema.parse({ ...validPayload, fillLevel })).toThrow();
  });

  it.each([-1, 101])('rejects battery out of 0-100 range (%s)', (battery) => {
    expect(() => telemetrySchema.parse({ ...validPayload, battery })).toThrow();
  });

  it('rejects a non-numeric temperature', () => {
    expect(() => telemetrySchema.parse({ ...validPayload, temperature: 'hot' })).toThrow();
  });

  it.each([-91, 91])('rejects latitude out of -90..90 range (%s)', (latitude) => {
    expect(() => telemetrySchema.parse({ ...validPayload, latitude })).toThrow();
  });

  it.each([-181, 181])('rejects longitude out of -180..180 range (%s)', (longitude) => {
    expect(() => telemetrySchema.parse({ ...validPayload, longitude })).toThrow();
  });

  it('rejects an invalid timestamp', () => {
    expect(() => telemetrySchema.parse({ ...validPayload, timestamp: 'not-a-date' })).toThrow();
  });

  it('accepts boundary values (0 and 100, poles and antimeridian)', () => {
    const boundary = {
      ...validPayload,
      fillLevel: 0,
      battery: 100,
      latitude: -90,
      longitude: 180,
    };
    expect(() => telemetrySchema.parse(boundary)).not.toThrow();
  });
});
