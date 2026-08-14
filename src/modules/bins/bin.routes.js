import { Router } from 'express';

import { listBins, getBin, getBinTelemetryHistory } from './bin.controller.js';

const router = Router();

router.get('/', listBins);
router.get('/:binId/telemetry', getBinTelemetryHistory);
router.get('/:binId', getBin);

export { router as binRouter };
