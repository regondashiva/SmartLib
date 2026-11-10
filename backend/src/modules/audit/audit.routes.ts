import { Router } from 'express';
import { auditController } from './audit.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { getAuditLogsQuerySchema } from './audit.schema.js';

const router = Router();

// Protected: Admin-only access to system audit logs
router.use(authenticate, requireRole(['ADMIN']));

// GET /api/v1/audit-logs
router.get(
  '/',
  validateRequest({ query: getAuditLogsQuerySchema }),
  (req, res, next) => auditController.getAuditLogs(req, res, next)
);

export default router;

