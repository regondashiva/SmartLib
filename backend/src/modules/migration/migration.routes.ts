import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { migrationController } from './migration.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ValidationError } from '../../utils/errors.js';
import {
  createBatchSchema,
  batchIdParamSchema,
  listBatchesQuerySchema,
  previewQuerySchema,
} from './migration.schema.js';

const router = Router();

// Configure Multer for in-memory processing up to 50MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.csv', '.xlsx', '.xls', '.json', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported file type '${ext}'. Supported formats: CSV (.csv), Excel (.xlsx), and JSON (.json).`));
    }
  },
});

// All migration endpoints require authentication and ADMIN role
router.use(authenticate);
router.use(requireRole(['ADMIN']));

// ─── Direct File Upload ────────────────────────────────────────────────────────
// POST /api/v1/migrations/upload
router.post(
  '/upload',
  upload.single('file'),
  (req, res, next) => migrationController.uploadFile(req, res, next)
);

// ─── Batch Lifecycle Operations ────────────────────────────────────────────────
// GET /api/v1/migrations (and /batches)
router.get(
  '/',
  validateRequest({ query: listBatchesQuerySchema }),
  (req, res, next) => migrationController.listBatches(req, res, next)
);
router.get(
  '/batches',
  validateRequest({ query: listBatchesQuerySchema }),
  (req, res, next) => migrationController.listBatches(req, res, next)
);

// POST /api/v1/migrations (and /batches)
router.post(
  '/',
  validateRequest({ body: createBatchSchema }),
  (req, res, next) => migrationController.createBatch(req, res, next)
);
router.post(
  '/batches',
  validateRequest({ body: createBatchSchema }),
  (req, res, next) => migrationController.createBatch(req, res, next)
);

// GET /api/v1/migrations/:id (and /batches/:id)
router.get(
  '/:id',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.getBatchById(req, res, next)
);
router.get(
  '/batches/:id',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.getBatchById(req, res, next)
);

// POST /api/v1/migrations/:id/validate (and /batches/:id/validate)
router.post(
  '/:id/validate',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.validateBatch(req, res, next)
);
router.post(
  '/batches/:id/validate',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.validateBatch(req, res, next)
);

// POST /api/v1/migrations/:id/dry-run (and /batches/:id/dry-run)
router.post(
  '/:id/dry-run',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.dryRunBatch(req, res, next)
);
router.post(
  '/batches/:id/dry-run',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.dryRunBatch(req, res, next)
);

// GET /api/v1/migrations/:id/preview (and /batches/:id/preview)
router.get(
  '/:id/preview',
  validateRequest({ params: batchIdParamSchema, query: previewQuerySchema }),
  (req, res, next) => migrationController.previewBatch(req, res, next)
);
router.get(
  '/batches/:id/preview',
  validateRequest({ params: batchIdParamSchema, query: previewQuerySchema }),
  (req, res, next) => migrationController.previewBatch(req, res, next)
);

// POST /api/v1/migrations/:id/commit (and /batches/:id/commit)
router.post(
  '/:id/commit',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.commitBatch(req, res, next)
);
router.post(
  '/batches/:id/commit',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.commitBatch(req, res, next)
);

// POST /api/v1/migrations/:id/rollback (and /batches/:id/rollback)
router.post(
  '/:id/rollback',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.rollbackBatch(req, res, next)
);
router.post(
  '/batches/:id/rollback',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.rollbackBatch(req, res, next)
);

// GET /api/v1/migrations/:id/errors (and /batches/:id/errors/export)
router.get(
  '/:id/errors',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.getErrors(req, res, next)
);
router.get(
  '/:id/errors/export',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.exportErrorsCsv(req, res, next)
);
router.get(
  '/batches/:id/errors/export',
  validateRequest({ params: batchIdParamSchema }),
  (req, res, next) => migrationController.exportErrorsCsv(req, res, next)
);

export default router;
