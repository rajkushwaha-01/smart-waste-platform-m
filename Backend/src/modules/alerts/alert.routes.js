import { Router } from 'express';

import { listAlerts } from './alert.controller.js';

const router = Router();

router.get('/', listAlerts);

export { router as alertRouter };
