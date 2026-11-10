import { Router } from 'express';
import { systemLifecycleController } from './system.controller.js';
import {
  executeRealPostgresBackupAndIsolatedRestore,
  generateProjectSbomAndLicenseInventory,
} from './postgres-backup-restore.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateRequest } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import {
  validatePackageBodySchema,
  createBackupBodySchema,
  verifyBackupRestoreBodySchema,
  executeUpdateBodySchema,
  executeRollbackBodySchema,
  systemHistoryQuerySchema,
} from './system.schema.js';

const router = Router();

// All system deployment, update, backup, and rollback operations require authentication and ADMIN role
router.use(authenticate);
router.use(requireRole(['ADMIN']));

// GET /api/v1/system/version — Current version, manifest, state machine, backups & rollback eligibility
router.get('/version', (req, res, next) =>
  systemLifecycleController.getVersionAndStatus(req, res, next)
);

// GET /api/v1/system/diagnostics — Recovery status, health checks & RFID SQLite queue compatibility
router.get('/diagnostics', (req, res, next) =>
  systemLifecycleController.getDiagnostics(req, res, next)
);

// GET /api/v1/system/history — Paginated update, backup, and rollback history
router.get(
  '/history',
  validateRequest({ query: systemHistoryQuerySchema }),
  (req, res, next) => systemLifecycleController.getHistory(req, res, next)
);

// POST /api/v1/system/packages/validate — Validate offline update manifest, checksums & compatibility
router.post(
  '/packages/validate',
  validateRequest({ body: validatePackageBodySchema }),
  (req, res, next) => systemLifecycleController.validatePackage(req, res, next)
);

// POST /api/v1/system/backups — Create and verify a database backup snapshot
router.post(
  '/backups',
  validateRequest({ body: createBackupBodySchema }),
  (req, res, next) => systemLifecycleController.createBackup(req, res, next)
);

// POST /api/v1/system/backups/verify — Verify backup SHA-256 & restore readiness (or execute restore)
router.post(
  '/backups/verify',
  validateRequest({ body: verifyBackupRestoreBodySchema }),
  (req, res, next) => systemLifecycleController.verifyOrRestoreBackup(req, res, next)
);

// POST /api/v1/system/updates/execute — Run 11-step controlled update lifecycle with auto-rollback
router.post(
  '/updates/execute',
  validateRequest({ body: executeUpdateBodySchema }),
  (req, res, next) => systemLifecycleController.executeUpdate(req, res, next)
);

// POST /api/v1/system/rollback — Roll back application to last known-good version
router.post(
  '/rollback',
  validateRequest({ body: executeRollbackBodySchema }),
  (req, res, next) => systemLifecycleController.executeRollback(req, res, next)
);

// POST /api/v1/system/postgresql-restore-test — Execute real SQL DDL+DML backup & isolated PostgreSQL restore
router.post('/postgresql-restore-test', async (_req, res, next) => {
  try {
    const report = await executeRealPostgresBackupAndIsolatedRestore();
    sendSuccess(
      res,
      report,
      'Real PostgreSQL SQL backup, simulated migration failure, and isolated restore verified',
      201
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/system/sbom — Generate CycloneDX 1.5 SBOM & Dependency License Inventory
router.get('/sbom', (_req, res, next) => {
  try {
    const sbom = generateProjectSbomAndLicenseInventory();
    sendSuccess(res, sbom, 'CycloneDX 1.5 SBOM and license inventory generated', 200);
  } catch (err) {
    next(err);
  }
});

export default router;

