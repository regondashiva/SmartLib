import { Router } from 'express';
import { rfidController } from './rfid.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

// Protected: RFID operators, librarians, administrators
router.use(authenticate);

// GET /api/v1/rfid/devices
router.get('/devices', (req, res, next) => rfidController.getDevices(req, res, next));

// GET /api/v1/rfid/tags
router.get('/tags', (req, res, next) => rfidController.getTags(req, res, next));

// POST /api/v1/rfid/tags
router.post(
  '/tags',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  (req, res, next) => rfidController.assignTag(req, res, next)
);

// PUT /api/v1/rfid/tags/:id/reassign
router.put(
  '/tags/:id/reassign',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  (req, res, next) => rfidController.reassignTag(req, res, next)
);

// POST /api/v1/rfid/gate-events
router.post(
  '/gate-events',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  (req, res, next) => rfidController.recordGateEvent(req, res, next)
);

// GET /api/v1/rfid/gate-events/:id/cctv-snapshot
router.get(
  '/gate-events/:id/cctv-snapshot',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  (req, res, next) => rfidController.getGateEventCctvSnapshot(req, res, next)
);

// POST /api/v1/rfid/footfall
router.post(
  '/footfall',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  (req, res, next) => rfidController.recordFootfallEvent(req, res, next)
);

// GET /api/v1/rfid/footfall
router.get(
  '/footfall',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  (req, res, next) => rfidController.getFootfallSummary(req, res, next)
);

// POST /api/v1/rfid/inventory-sessions
router.post(
  '/inventory-sessions',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  (req, res, next) => rfidController.reconcileInventorySession(req, res, next)
);

export default router;
