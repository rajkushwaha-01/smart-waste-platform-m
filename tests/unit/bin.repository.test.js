import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/bins/bin.model.js', () => ({
  Bin: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
  },
}));

import { Bin } from '../../src/modules/bins/bin.model.js';
import * as binRepository from '../../src/modules/bins/bin.repository.js';

describe('bin.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findByBinId queries by binId', async () => {
    Bin.findOne.mockResolvedValue({ binId: 'BIN-001' });

    const result = await binRepository.findByBinId('BIN-001');

    expect(Bin.findOne).toHaveBeenCalledWith({ binId: 'BIN-001' });
    expect(result).toEqual({ binId: 'BIN-001' });
  });

  it('upsertFromTelemetry updates live fields with upsert:true', async () => {
    Bin.findOneAndUpdate.mockResolvedValue({ binId: 'BIN-001' });

    await binRepository.upsertFromTelemetry('BIN-001', {
      fillLevel: 77,
      battery: 60,
      temperature: 29,
      latitude: 22.7,
      longitude: 75.8,
    });

    expect(Bin.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, options] = Bin.findOneAndUpdate.mock.calls[0];

    expect(filter).toEqual({ binId: 'BIN-001' });
    expect(update.$set.currentFillLevel).toBe(77);
    expect(update.$set.battery).toBe(60);
    expect(update.$set['location.latitude']).toBe(22.7);
    expect(update.$set['location.longitude']).toBe(75.8);
    expect(update.$set.lastTelemetryAt).toBeInstanceOf(Date);
    expect(update.$setOnInsert).toEqual({ status: 'active', priority: 'low' });
    expect(options).toMatchObject({ upsert: true, new: true, runValidators: true });
  });

  it('updatePriority sets only the priority field', async () => {
    Bin.findOneAndUpdate.mockResolvedValue({ binId: 'BIN-001', priority: 'high' });

    await binRepository.updatePriority('BIN-001', 'high');

    expect(Bin.findOneAndUpdate).toHaveBeenCalledWith(
      { binId: 'BIN-001' },
      { $set: { priority: 'high' } },
      { new: true },
    );
  });

  it('applyDecisionState sets fillStatus, priority, maintenanceRequired, and collectionRequired together', async () => {
    Bin.findOneAndUpdate.mockResolvedValue({ binId: 'BIN-001', fillStatus: 'full' });

    await binRepository.applyDecisionState('BIN-001', {
      fillStatus: 'full',
      priority: 'high',
      maintenanceRequired: false,
      collectionRequired: true,
    });

    expect(Bin.findOneAndUpdate).toHaveBeenCalledWith(
      { binId: 'BIN-001' },
      {
        $set: {
          fillStatus: 'full',
          priority: 'high',
          maintenanceRequired: false,
          collectionRequired: true,
        },
      },
      { new: true, runValidators: true },
    );
  });

  it('list applies status and priority filters when given', async () => {
    const sortMock = vi.fn().mockResolvedValue([]);
    Bin.find.mockReturnValue({ sort: sortMock });

    await binRepository.list({ status: 'active', priority: 'high' });

    expect(Bin.find).toHaveBeenCalledWith({ status: 'active', priority: 'high' });
    expect(sortMock).toHaveBeenCalled();
  });

  it('findManyByBinIds queries with $in and returns lean documents', async () => {
    const leanMock = vi.fn().mockResolvedValue([{ binId: 'BIN-001' }, { binId: 'BIN-002' }]);
    Bin.find.mockReturnValue({ lean: leanMock });

    const result = await binRepository.findManyByBinIds(['BIN-001', 'BIN-002']);

    expect(Bin.find).toHaveBeenCalledWith({ binId: { $in: ['BIN-001', 'BIN-002'] } });
    expect(result).toEqual([{ binId: 'BIN-001' }, { binId: 'BIN-002' }]);
  });

  it('findManyByBinIds short-circuits to [] for an empty/missing list, without querying', async () => {
    expect(await binRepository.findManyByBinIds([])).toEqual([]);
    expect(await binRepository.findManyByBinIds(undefined)).toEqual([]);
    expect(Bin.find).not.toHaveBeenCalled();
  });
});
