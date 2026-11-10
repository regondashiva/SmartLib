import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';

const router = Router();

// GET /api/v1/dashboard/summary (High-level institutional statistics)
router.get('/summary', (req, res, next) => dashboardController.getSummary(req, res, next));

export default router;

