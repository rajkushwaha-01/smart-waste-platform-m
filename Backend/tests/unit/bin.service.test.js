import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/bins/bin.repository.js', () => ({
  list: vi.fn(),
  findByBinId: vi.fn(),
}));

vi.mock('../../src/modules/telemetry/telemetryHistory.repository.js', () => ({
  queryTelemetryHistory: vi.fn(),
}));

vi.mock('../../src/shared/database/timeseriesClient.js', () => ({
  getTimeseriesClient: vi.fn().mockReturnValue({ fake: true }),
}));

import * as binRepository from '../../src/modules/bins/bin.repository.js';
import { queryTelemetryHistory } from '../../src/modules/telemetry/telemetryHistory.repository.js';
import * as binService from '../../src/modules/bins/bin.service.js';

const bin = { binId: 'BIN-001', currentFillLevel: 42 };

describe('bin.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listBins', () => {
    it('delegates to the repository with the given filters', async () => {
      binRepository.list.mockResolvedValue([bin]);

      const result = await binService.listBins({ status: 'active' });

      expect(binRepository.list).toHaveBeenCalledWith({ status: 'active', priority: undefined });
      expect(result).toEqual([bin]);
    });
  });

  describe('getBin', () => {
    it('returns the bin when found', async () => {
      binRepository.findByBinId.mockResolvedValue(bin);

      await expect(binService.getBin('BIN-001')).resolves.toEqual(bin);
    });

    it('throws NotFoundError when the bin does not exist', async () => {
      binRepository.findByBinId.mockResolvedValue(null);

      await expect(binService.getBin('BIN-404')).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });
  });

  describe('getBinTelemetryHistory', () => {
    beforeEach(() => {
      binRepository.findByBinId.mockResolvedValue(bin);
    });

    it('404s before querying the time-series store when the bin does not exist', async () => {
      binRepository.findByBinId.mockResolvedValue(null);

      await expect(binService.getBinTelemetryHistory('BIN-404', {})).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(queryTelemetryHistory).not.toHaveBeenCalled();
    });

    it('queries with defaults when no from/to/limit are given', async () => {
      queryTelemetryHistory.mockResolvedValue([{ time: '2026-08-09T08:10:00Z', fillLevel: 82 }]);

      const result = await binService.getBinTelemetryHistory('BIN-001', {});

      expect(queryTelemetryHistory).toHaveBeenCalledWith(
        { fake: true },
        { binId: 'BIN-001', from: undefined, to: undefined, limit: 100 },
      );
      expect(result).toEqual([{ time: '2026-08-09T08:10:00Z', fillLevel: 82 }]);
    });

    it('parses from/to/limit query params into a bounded query', async () => {
      queryTelemetryHistory.mockResolvedValue([]);

      await binService.getBinTelemetryHistory('BIN-001', {
        from: '2026-08-01T00:00:00Z',
        to: '2026-08-09T00:00:00Z',
        limit: '50',
      });

      const [, options] = queryTelemetryHistory.mock.calls[0];
      expect(options.binId).toBe('BIN-001');
      expect(options.from).toEqual(new Date('2026-08-01T00:00:00Z'));
      expect(options.to).toEqual(new Date('2026-08-09T00:00:00Z'));
      expect(options.limit).toBe(50);
    });

    it('rejects an invalid "from" value', async () => {
      await expect(
        binService.getBinTelemetryHistory('BIN-001', { from: 'not-a-date' }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(queryTelemetryHistory).not.toHaveBeenCalled();
    });

    it('rejects a limit above the maximum', async () => {
      await expect(
        binService.getBinTelemetryHistory('BIN-001', { limit: '5000' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects when "from" is after "to"', async () => {
      await expect(
        binService.getBinTelemetryHistory('BIN-001', {
          from: '2026-08-09T00:00:00Z',
          to: '2026-08-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(queryTelemetryHistory).not.toHaveBeenCalled();
    });
  });
});
