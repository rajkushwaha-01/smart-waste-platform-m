import axios from 'axios';

function escapeTagKeyOrValue(value) {
  return String(value).replace(/([,= ])/g, '\\$1');
}

function escapeFieldStringValue(value) {
  return String(value).replace(/"/g, '\\"');
}

/** Formats a single field value per InfluxDB line-protocol rules, or
 * returns null to signal "omit this field" for null/undefined input. */
function formatFieldValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Number.isInteger(value) ? `${value}i` : String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `"${escapeFieldStringValue(value)}"`;
}

/**
 * Adapter around InfluxDB 1.x's HTTP line-protocol write API.
 *
 * This class is the ONLY place in the codebase that knows the
 * specific time-series database/wire format in use. Everything else
 * (repositories, services) depends only on the writePoint()/ping()/
 * close() contract below, so swapping the underlying engine later
 * (Influx 2.x, TimescaleDB, etc.) means writing a new class with the
 * same contract — no callers need to change.
 *
 * The HTTP client is injectable for testing; production code gets a
 * real axios instance via createTimeseriesClient() below.
 */
export class TimeseriesClient {
  constructor({ baseUrl, dbName, username, password, timeoutMs = 5000, httpClient } = {}) {
    if (!dbName) {
      throw new Error('TimeseriesClient requires a dbName');
    }

    this.dbName = dbName;
    this.http =
      httpClient ??
      axios.create({
        baseURL: baseUrl,
        timeout: timeoutMs,
        auth: username ? { username, password } : undefined,
      });
  }

  /**
   * Writes one measurement point.
   * @param {string} measurement - e.g. "telemetry"
   * @param {object} point
   * @param {Record<string,string>} [point.tags] - low-cardinality, indexed
   * @param {Record<string,string|number|boolean>} point.fields - the actual measurements
   * @param {number|Date} [point.timestamp] - defaults to now; written at ms precision
   */
  async writePoint(measurement, { tags = {}, fields = {}, timestamp = Date.now() } = {}) {
    const tagString = Object.entries(tags)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${escapeTagKeyOrValue(key)}=${escapeTagKeyOrValue(value)}`)
      .join(',');

    const fieldString = Object.entries(fields)
      .map(([key, value]) => [key, formatFieldValue(value)])
      .filter(([, formatted]) => formatted !== null)
      .map(([key, formatted]) => `${escapeTagKeyOrValue(key)}=${formatted}`)
      .join(',');

    if (!fieldString) {
      throw new Error('writePoint requires at least one non-null field');
    }

    const ms = timestamp instanceof Date ? timestamp.getTime() : timestamp;
    const line = `${escapeTagKeyOrValue(measurement)}${tagString ? ',' + tagString : ''} ${fieldString} ${Math.round(ms)}`;

    await this.http.post('/write', line, {
      params: { db: this.dbName, precision: 'ms' },
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  /** Lightweight reachability check. Returns false on any failure
   * rather than throwing, since this is used for best-effort status
   * reporting, not as a precondition for writes. */
  async ping() {
    try {
      const res = await this.http.get('/ping', { validateStatus: () => true });
      return res.status === 204 || res.status === 200;
    } catch {
      return false;
    }
  }

  async close() {
    // A plain HTTP client holds no persistent connection to release;
    // this method exists so callers can treat every data-layer client
    // (Mongo, time-series, future Kafka clients) symmetrically during
    // shutdown without caring which ones actually need to close.
  }
}

let singleton;

/** Lazily creates and returns the process-wide TimeseriesClient,
 * configured from central config. */
export function getTimeseriesClient(config) {
  if (!singleton) {
    singleton = new TimeseriesClient({
      baseUrl: config.timeseries.url,
      dbName: config.timeseries.dbName,
      username: config.timeseries.user || undefined,
      password: config.timeseries.password || undefined,
    });
  }
  return singleton;
}
