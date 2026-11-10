import { Router, Request, Response, NextFunction } from 'express';
import { serialsService } from './serials.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/apiResponse.js';

const router = Router();

router.use(authenticate);

// GET /api/v1/serials/reports (must precede /:id)
router.get(
  '/reports',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await serialsService.getSerialsReport();
      sendSuccess(res, report, 'Serials management report retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/serials
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await serialsService.getSerials({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      frequency: typeof req.query.frequency === 'string' ? req.query.frequency : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    sendSuccess(res, list, 'Serial subscriptions retrieved', 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/serials
router.post(
  '/',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await serialsService.createSerial(req.body, {
        userId: req.user!.userId,
        email: req.user!.email,
      });
      sendSuccess(res, created, 'Serial subscription created', 201);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/serials/issues/:issueId
router.put(
  '/issues/:issueId',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await serialsService.updateIssue(req.params.issueId as string, req.body, {
        userId: req.user!.userId,
        email: req.user!.email,
      });
      sendSuccess(res, updated, 'Serial issue updated', 200);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/serials/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serial = await serialsService.getSerialById(req.params.id as string);
    sendSuccess(res, serial, 'Serial details retrieved', 200);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/serials/:id
router.put(
  '/:id',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await serialsService.updateSerial(req.params.id as string, req.body, {
        userId: req.user!.userId,
        email: req.user!.email,
      });
      sendSuccess(res, updated, 'Serial subscription updated', 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/serials/:id/issues
router.post(
  '/:id/issues',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await serialsService.createIssue(req.params.id as string, req.body, {
        userId: req.user!.userId,
        email: req.user!.email,
      });
      sendSuccess(res, created, 'Serial issue tracked', 201);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

