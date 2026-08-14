import axios from 'axios';

function escapeTagKeyOrValue(value) {
  return String(value).replace(/([,= ])/g, '\\$1');
}

function escapeFieldStringValue(value) {
  return String(value).replace(/"/g, '\\"');
}

function escapeInfluxQLString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Turns an InfluxDB 1.x query response into a flat array of plain
 * objects (one per row, keyed by column name). Returns [] for any
 * shape with no matching series (e.g. no data in range). */
function parseSeriesResponse(data) {
  const series = data?.results?.[0]?.series;
  if (!Array.isArray(series) || series.length === 0) {
    return [];
  }

  const { columns, values } = series[0];
  return values.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

/** Formats a single field value per InfluxDB line-protocol rules, or
 * returns null to signal "omit this field" for null/undefined input. */
function formatFieldValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Number.isInteger(value) ? `${value}i` : String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
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

  /**
   * Queries points for one measurement, optionally filtered by tag
   * equality and/or a time range, newest first. This — together with
   * writePoint() — is the ONLY place in the codebase that constructs
   * InfluxQL; callers (telemetryHistory.repository.js) never see the
   * query language, same as they never see the line-protocol format.
   *
   * @param {string} measurement - e.g. "telemetry"
   * @param {object} [options]
   * @param {Record<string,string>} [options.tags] - equality filters on indexed tags (e.g. { binId })
   * @param {number|Date} [options.from] - inclusive lower time bound
   * @param {number|Date} [options.to] - inclusive upper time bound
   * @param {number} [options.limit] - max points to return (default 500)
   */
  async query(measurement, { tags = {}, from, to, limit = 500 } = {}) {
    const conditions = Object.entries(tags)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `"${key}" = '${escapeInfluxQLString(value)}'`);

    if (from !== undefined) {
      const fromMs = from instanceof Date ? from.getTime() : from;
      conditions.push(`time >= ${Math.round(fromMs)}ms`);
    }
    if (to !== undefined) {
      const toMs = to instanceof Date ? to.getTime() : to;
      conditions.push(`time <= ${Math.round(toMs)}ms`);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const q = `SELECT * FROM "${measurement}"${where} ORDER BY time DESC LIMIT ${Math.trunc(limit)}`;

    const res = await this.http.get('/query', { params: { db: this.dbName, q } });

    const queryError = res.data?.results?.[0]?.error;
    if (queryError) {
      throw new Error(`Time-series query failed: ${queryError}`);
    }

    return parseSeriesResponse(res.data);
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
      timeoutMs: config.timeseries.timeoutMs,
    });
  }
  return singleton;
}
