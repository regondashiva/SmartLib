import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { exportReportQuerySchema, reportFilterQuerySchema } from './reports.schema.js';

const router = Router();

// All report endpoints require authentication
router.use(authenticate);

// ─── Dashboard & Institutional Summary ────────────────────────────────────────
router.get(
  '/dashboard',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getDashboard(req, res, next)
);

router.get(
  '/summary',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getSummary(req, res, next)
);

// ─── Core Operational Reports ──────────────────────────────────────────────────
// GET /api/v1/reports/circulation
router.get(
  '/circulation',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getCirculation(req, res, next)
);

// GET /api/v1/reports/overdue
router.get(
  '/overdue',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getOverdue(req, res, next)
);

// GET /api/v1/reports/inventory
router.get(
  '/inventory',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getInventory(req, res, next)
);

// GET /api/v1/reports/members
router.get(
  '/members',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getMembers(req, res, next)
);

// GET /api/v1/reports/fines
router.get(
  '/fines',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getFines(req, res, next)
);

// GET /api/v1/reports/rfid
router.get(
  '/rfid',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getRfid(req, res, next)
);

// GET /api/v1/reports/security-gates
router.get(
  '/security-gates',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getSecurityGates(req, res, next)
);

// GET /api/v1/reports/operators (ADMIN & LIBRARIAN)
router.get(
  '/operators',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getOperators(req, res, next)
);

// GET /api/v1/reports/migrations (ADMIN & LIBRARIAN)
router.get(
  '/migrations',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ query: reportFilterQuerySchema }),
  (req, res, next) => reportsController.getMigrations(req, res, next)
);

// ─── Export Endpoints (PDF & CSV) ──────────────────────────────────────────────
// GET /api/v1/reports/export/pdf
router.get(
  '/export/pdf',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ query: exportReportQuerySchema }),
  (req, res, next) => reportsController.exportPdf(req, res, next)
);

// GET /api/v1/reports/export/csv
router.get(
  '/export/csv',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ query: exportReportQuerySchema }),
  (req, res, next) => reportsController.exportCsv(req, res, next)
);

// GET /api/v1/reports/export (Legacy & unified export)
router.get(
  '/export',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ query: exportReportQuerySchema }),
  (req, res, next) => reportsController.exportReport(req, res, next)
);

// POST /api/v1/reports/export
router.post(
  '/export',
  requireRole(['ADMIN', 'LIBRARIAN']),
  (req, res, next) => {
    req.query = { ...req.query, ...req.body };
    return reportsController.exportReport(req, res, next);
  }
);

export default router;
