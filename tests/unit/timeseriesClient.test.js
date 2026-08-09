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
});
