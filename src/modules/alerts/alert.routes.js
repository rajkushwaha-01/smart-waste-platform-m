import express from 'express';
import { listAlerts } from './alert.controller.js';

const router = express.Router();

// GET /api/v1/alerts
router.get('/', listAlerts);

export { router as alertsRouter };
