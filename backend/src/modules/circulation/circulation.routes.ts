import { Router } from 'express';
import { circulationController } from './circulation.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import {
  getCirculationsQuerySchema,
  getCirculationByIdSchema,
  issueBookSchema,
  returnLoanSchema,
  renewLoanSchema,
  payFineSchema,
  waiveFineSchema,
  getFinesQuerySchema,
} from './circulation.schema.js';

const router = Router();

// All circulation routes require authentication
router.use(authenticate);

// ─── Circulation CRUD ────────────────────────────────────────────────────────

// GET /api/v1/circulation
router.get(
  '/',
  validateRequest({ query: getCirculationsQuerySchema }),
  (req, res, next) => circulationController.getCirculations(req, res, next)
);

// GET /api/v1/circulation/due-date-enquiry (must precede /:id)
router.get('/due-date-enquiry', (req, res, next) =>
  circulationController.dueDateEnquiry(req, res, next)
);

// GET /api/v1/circulation/fines  (must be before /:id to avoid clash)
router.get(
  '/fines',
  validateRequest({ query: getFinesQuerySchema }),
  (req, res, next) => circulationController.getFines(req, res, next)
);

// GET /api/v1/circulation/:id
router.get(
  '/:id',
  validateRequest({ params: getCirculationByIdSchema }),
  (req, res, next) => circulationController.getCirculationById(req, res, next)
);

// ─── Transactions (Librarian / Admin only) ───────────────────────────────────

// POST /api/v1/circulation/issue
router.post(
  '/issue',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ body: issueBookSchema }),
  (req, res, next) => circulationController.issueBook(req, res, next)
);

// POST /api/v1/circulation/return
router.post(
  '/return',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ body: returnLoanSchema }),
  (req, res, next) => circulationController.returnLoan(req, res, next)
);

// POST /api/v1/circulation/renew
router.post(
  '/renew',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ body: renewLoanSchema }),
  (req, res, next) => circulationController.renewLoan(req, res, next)
);

// ─── Fine Management (Librarian / Admin only) ────────────────────────────────

// POST /api/v1/circulation/fines/pay
router.post(
  '/fines/pay',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ body: payFineSchema }),
  (req, res, next) => circulationController.payFine(req, res, next)
);

// POST /api/v1/circulation/fines/waive
router.post(
  '/fines/waive',
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ body: waiveFineSchema }),
  (req, res, next) => circulationController.waiveFine(req, res, next)
);

export default router;
