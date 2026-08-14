import { Router } from 'express';

import { getQueue, getOptimizedRoute, assignTask, completeTask } from './collection.controller.js';

const router = Router();

router.get('/queue', getQueue);
router.get('/route', getOptimizedRoute);
router.post('/tasks/:taskId/assign', assignTask);
router.post('/tasks/:taskId/complete', completeTask);

export { router as collectionRouter };
