import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as binService from './bin.service.js';

export const listBins = asyncHandler(async (req, res) => {
  const { status, priority } = req.query;
  const bins = await binService.listBins({ status, priority });
  res.status(200).json({ status: 'ok', count: bins.length, bins });
});

export const getBin = asyncHandler(async (req, res) => {
  const bin = await binService.getBin(req.params.binId);
  res.status(200).json({ status: 'ok', bin });
});

export const getBinTelemetryHistory = asyncHandler(async (req, res) => {
  const telemetry = await binService.getBinTelemetryHistory(req.params.binId, req.query);
  res.status(200).json({
    status: 'ok',
    binId: req.params.binId,
    count: telemetry.length,
    telemetry,
  });
});
