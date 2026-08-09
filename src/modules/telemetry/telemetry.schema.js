import { z } from 'zod';

/**
 * Shape of a telemetry reading as sent by a real IoT device or the
 * Mock IoT simulator to POST /api/v1/telemetry. Both producers hit
 * the same endpoint and are validated identically — there is no
 * separate "mock" schema or code path.
 */
export const telemetrySchema = z.object({
  eventId: z.string().trim().min(1, 'eventId is required'),
  binId: z.string().trim().min(1, 'binId is required'),
  fillLevel: z
    .number({ invalid_type_error: 'fillLevel must be a number' })
    .min(0, 'fillLevel must be between 0 and 100')
    .max(100, 'fillLevel must be between 0 and 100'),
  battery: z
    .number({ invalid_type_error: 'battery must be a number' })
    .min(0, 'battery must be between 0 and 100')
    .max(100, 'battery must be between 0 and 100'),
  temperature: z
    .number({ invalid_type_error: 'temperature must be a number' })
    .finite('temperature must be a finite number'),
  latitude: z
    .number({ invalid_type_error: 'latitude must be a number' })
    .min(-90, 'latitude must be between -90 and 90')
    .max(90, 'latitude must be between -90 and 90'),
  longitude: z
    .number({ invalid_type_error: 'longitude must be a number' })
    .min(-180, 'longitude must be between -180 and 180')
    .max(180, 'longitude must be between -180 and 180'),
  timestamp: z
    .string({ invalid_type_error: 'timestamp must be an ISO 8601 datetime string' })
    .datetime({ offset: true, message: 'timestamp must be a valid ISO 8601 datetime' }),
});

/** Parses and validates a raw payload, throwing a ZodError (mapped to
 * a 400 by the central error handler) on failure. */
export function parseTelemetry(payload) {
  return telemetrySchema.parse(payload);
}
