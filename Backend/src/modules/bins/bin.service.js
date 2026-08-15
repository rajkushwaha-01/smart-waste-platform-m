import { z } from 'zod';

import { config } from '../../config/index.js';
import { getTimeseriesClient } from '../../shared/database/timeseriesClient.js';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError.js';
import { queryTelemetryHistory } from '../telemetry/telemetryHistory.repository.js';
import * as binRepository from './bin.repository.js';

const DEFAULT_HISTORY_LIMIT = 100;
const MAX_HISTORY_LIMIT = 1000;

const telemetryQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().positive().max(MAX_HISTORY_LIMIT).optional(),
});

export async function listBins({ status, priority } = {}) {
  return binRepository.list({ status, priority });
}

export async function getBin(binId) {
  const bin = await binRepository.findByBinId(binId);
  if (!bin) {
    throw new NotFoundError(`Bin not found: ${binId}`);
  }
  return bin;
}

/**
 * Historical telemetry for one bin, read straight from the
 * time-series store — MongoDB only ever holds the bin's current
 * snapshot (see bin.repository.upsertFromTelemetry), never the full
 * history, so there's nothing to page through in Mongo here.
 *
 * `from`/`to` are optional ISO 8601 bounds; with neither given this
 * returns the most recent `limit` (default 100, capped at 1000)
 * readings.
 */
export async function getBinTelemetryHistory(binId, query = {}) {
  // 404s first if the bin itself doesn't exist, before touching the
  // time-series store at all.
  await getBin(binId);

  const parsed = telemetryQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new ValidationError('Invalid telemetry history query', parsed.error.issues);
  }

  const { from, to, limit = DEFAULT_HISTORY_LIMIT } = parsed.data;

  if (from && to && new Date(from) > new Date(to)) {
    throw new ValidationError('"from" must not be after "to"');
  }

  const timeseriesClient = getTimeseriesClient(config);
  return queryTelemetryHistory(timeseriesClient, {
    binId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    limit,
  });
}
