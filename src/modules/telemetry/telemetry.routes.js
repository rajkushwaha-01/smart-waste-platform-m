import { Router } from 'express';

import { ingestTelemetry } from './telemetry.controller.js';

const router = Router();

// POST /api/v1/telemetry — the OFFICIAL IoT ingestion endpoint. Real
// devices and the Mock IoT simulator both call this same route.
router.post('/', ingestTelemetry);

export { router as telemetryRouter };
