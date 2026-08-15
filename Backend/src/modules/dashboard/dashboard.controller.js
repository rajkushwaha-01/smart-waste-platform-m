import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as dashboardService from './dashboard.service.js';

// Returns the summary object directly (no {status, ...} envelope) —
// matches the exact response shape from the spec.
export const getSummary = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getSummary();
  res.status(200).json(summary);
});
