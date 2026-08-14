import { describe, expect, it, vi } from 'vitest';

import { TimeseriesClient } from '../../src/shared/database/timeseriesClient.js';

function makeFakeHttp({ postResult, getResult } = {}) {
  return {
    post: vi.fn().mockResolvedValue(postResult ?? { status: 204 }),
    get: vi.fn().mockResolvedValue(getResult ?? { status: 204 }),
  };
}

describe('TimeseriesClient', () => {
  it('writes a correctly formatted line-protocol point', async () => {
    const httpClient = makeFakeHttp();
    const client = new TimeseriesClient({ dbName: 'smart_waste_telemetry', httpClient });

    await client.writePoint('telemetry', {
      tags: { binId: 'BIN-001' },
      fields: { eventId: 'evt-1', fillLevel: 77.5, battery: 60, temperature: 29.1 },
      timestamp: 1_700_000_000_000,
    });

    expect(httpClient.post).toHaveBeenCalledTimes(1);
    const [path, body, options] = httpClient.post.mock.calls[0];

    expect(path).toBe('/write');
    expect(body).toBe(
      'telemetry,binId=BIN-001 eventId="evt-1",fillLevel=77.5,battery=60i,temperature=29.1 1700000000000',
    );
    expect(options.params).toEqual({ db: 'smart_waste_telemetry', precision: 'ms' });
  });

  it('escapes spaces and commas in tag values', async () => {
    const httpClient = makeFakeHttp();
    const client = new TimeseriesClient({ dbName: 'db', httpClient });

    await client.writePoint('telemetry', {
      tags: { binId: 'BIN, 001' },
      fields: { fillLevel: 10 },
    });

    const [, body] = httpClient.post.mock.calls[0];
    expect(body).toContain('binId=BIN\\,\\ 001');
  });

  it('omits null/undefined fields and throws if none remain', async () => {
    const httpClient = makeFakeHttp();
    const client = new TimeseriesClient({ dbName: 'db', httpClient });

    await client.writePoint('telemetry', {
      tags: { binId: 'BIN-001' },
      fields: { fillLevel: 50, temperature: null },
    });
    const [, body] = httpClient.post.mock.calls[0];
    expect(body).not.toContain('temperature');

    await expect(
      client.writePoint('telemetry', { tags: { binId: 'BIN-001' }, fields: { temperature: null } }),
    ).rejects.toThrow(/at least one/);
  });

  it('ping returns true on a 204/200 response and false on failure', async () => {
    const okClient = new TimeseriesClient({ dbName: 'db', httpClient: makeFakeHttp() });
    await expect(okClient.ping()).resolves.toBe(true);

    const failingHttp = { get: vi.fn().mockRejectedValue(new Error('unreachable')), post: vi.fn() };
    const failingClient = new TimeseriesClient({ dbName: 'db', httpClient: failingHttp });
    await expect(failingClient.ping()).resolves.toBe(false);
  });

  it('requires a dbName', () => {
    expect(() => new TimeseriesClient({ httpClient: makeFakeHttp() })).toThrow(/dbName/);
  });

  describe('query', () => {
    function makeSeriesResponse(columns, rows) {
      return { data: { results: [{ statement_id: 0, series: [{ name: 'telemetry', columns, values: rows }] }] } };
    }

    it('builds a WHERE clause from tag filters and a time range, and parses rows into objects', async () => {
      const httpClient = makeFakeHttp({
        getResult: makeSeriesResponse(
          ['time', 'battery', 'fillLevel'],
          [
            ['2026-08-09T08:10:00Z', 76, 82],
            ['2026-08-09T08:05:00Z', 77, 79],
          ],
        ),
      });
      const client = new TimeseriesClient({ dbName: 'db', httpClient });

      const points = await client.query('telemetry', {
        tags: { binId: 'BIN-001' },
        from: 1_700_000_000_000,
        to: 1_700_000_100_000,
        limit: 50,
      });

      expect(httpClient.get).toHaveBeenCalledTimes(1);
      const [path, options] = httpClient.get.mock.calls[0];
      expect(path).toBe('/query');
      expect(options.params.db).toBe('db');
      expect(options.params.q).toContain(`"binId" = 'BIN-001'`);
      expect(options.params.q).toContain('time >= 1700000000000ms');
      expect(options.params.q).toContain('time <= 1700000100000ms');
      expect(options.params.q).toContain('ORDER BY time DESC LIMIT 50');

      expect(points).toEqual([
        { time: '2026-08-09T08:10:00Z', battery: 76, fillLevel: 82 },
        { time: '2026-08-09T08:05:00Z', battery: 77, fillLevel: 79 },
      ]);
    });

    it('returns an empty array when there is no matching series', async () => {
      const httpClient = makeFakeHttp({ getResult: { data: { results: [{ statement_id: 0 }] } } });
      const client = new TimeseriesClient({ dbName: 'db', httpClient });

      await expect(client.query('telemetry', { tags: { binId: 'BIN-999' } })).resolves.toEqual([]);
    });

    it('throws when InfluxDB reports a query error', async () => {
      const httpClient = makeFakeHttp({
        getResult: { data: { results: [{ statement_id: 0, error: 'malformed query' }] } },
      });
      const client = new TimeseriesClient({ dbName: 'db', httpClient });

      await expect(client.query('telemetry', {})).rejects.toThrow(/malformed query/);
    });

    it('escapes single quotes in tag values', async () => {
      const httpClient = makeFakeHttp({ getResult: makeSeriesResponse(['time'], []) });
      const client = new TimeseriesClient({ dbName: 'db', httpClient });

      await client.query('telemetry', { tags: { binId: "BIN'; DROP" } });

      const [, options] = httpClient.get.mock.calls[0];
      expect(options.params.q).toContain(`'BIN\\'; DROP'`);
    });
  });

  describe('getTimeseriesClient factory', () => {
    it('passes the configured timeout through to the underlying HTTP client', async () => {
      vi.resetModules();
      const mod = await import('../../src/shared/database/timeseriesClient.js');

      const client = mod.getTimeseriesClient({
        timeseries: {
          url: 'http://localhost:8086',
          dbName: 'smart_waste_telemetry',
          user: '',
          password: '',
          timeoutMs: 1234,
        },
      });

      expect(client.http.defaults.timeout).toBe(1234);
    });
  });
});
