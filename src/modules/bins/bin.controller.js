import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as binRepository from './bin.repository.js';
import { getTimeseriesClient } from '../../shared/database/timeseriesClient.js';
import { config } from '../../config/index.js';
import { queryTelemetry } from '../telemetry/telemetryHistory.repository.js';

export const listBins = asyncHandler(async (req, res) => {
  const { status, priority } = req.query;
  const bins = await binRepository.list({ status, priority });
  res.json(bins);
});

export const getBin = asyncHandler(async (req, res) => {
  const { binId } = req.params;
  const bin = await binRepository.findByBinId(binId);
  if (!bin) return res.status(404).json({ error: 'not_found' });
  res.json(bin);
});

export const getBinTelemetry = asyncHandler(async (req, res) => {
  const { binId } = req.params;
  const { from, to, limit } = req.query;
  const timeseriesClient = getTimeseriesClient(config);
  const points = await queryTelemetry(timeseriesClient, { binId, from, to, limit: limit ? Number(limit) : undefined });
  res.json({ telemetry: points });
});
