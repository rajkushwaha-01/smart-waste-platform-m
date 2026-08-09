import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { getHealthStatus } from './health.service.js';

export const getHealth = asyncHandler(async (req, res) => {
  const health = getHealthStatus();
  res.status(200).json(health);
});
