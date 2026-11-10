import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateRequest } from '../../middleware/validate.js';
import { settingsHistoryQuerySchema, updateSettingsBodySchema } from './settings.schema.js';

const router = Router();

router.use(authenticate);

// GET /api/v1/settings — Read-only access for LIBRARIAN, full access for ADMIN
router.get(
  '/',
  requireRole(['ADMIN', 'LIBRARIAN']),
  (req, res, next) => settingsController.getSettings(req, res, next)
);

// PUT /api/v1/settings — Restricted strictly to ADMIN
router.put(
  '/',
  requireRole(['ADMIN']),
  validateRequest({ body: updateSettingsBodySchema }),
  (req, res, next) => settingsController.updateSettings(req, res, next)
);

// GET /api/v1/settings/history — Audit history of configuration changes
router.get(
  '/history',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ query: settingsHistoryQuerySchema }),
  (req, res, next) => settingsController.getHistory(req, res, next)
);

export default router;

