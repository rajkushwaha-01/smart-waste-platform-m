import express from 'express';
import { listBins, getBin, getBinTelemetry } from './bin.controller.js';

const router = express.Router();

// GET /api/v1/bins
router.get('/', listBins);

// GET /api/v1/bins/:binId
router.get('/:binId', getBin);

// GET /api/v1/bins/:binId/telemetry
router.get('/:binId/telemetry', getBinTelemetry);

export { router as binsRouter };
