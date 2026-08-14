import express from 'express';
import { summary } from './dashboard.controller.js';

const router = express.Router();

// GET /api/v1/dashboard/summary
router.get('/summary', summary);

export { router as dashboardRouter };
