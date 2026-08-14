import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as alertRepository from './alert.repository.js';

export const listAlerts = asyncHandler(async (req, res) => {
  const { status, severity } = req.query;
  const alerts = await alertRepository.list({ status, severity });
  res.status(200).json({ status: 'ok', count: alerts.length, alerts });
});
