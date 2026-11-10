import { Router, Request, Response, NextFunction } from 'express';
import { notificationsService } from './notifications.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { NotificationStatus } from '@prisma/client';

const router = Router();

router.use(authenticate);

// GET /api/v1/notifications
router.get(
  '/',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const memberId = typeof req.query.memberId === 'string' ? req.query.memberId : undefined;
      const status =
        typeof req.query.status === 'string'
          ? (req.query.status.toUpperCase() as NotificationStatus)
          : undefined;
      const data = await notificationsService.listQueue(memberId, status);
      sendSuccess(res, data, 'Notification queue and adapter status retrieved');
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/notifications/enqueue
router.post(
  '/enqueue',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await notificationsService.enqueueNotification(req.body, {
        userId: req.user!.userId,
        email: req.user!.email,
      });
      sendSuccess(res, data, 'Notification enqueued in PENDING state', 201);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/notifications/:id/dispatch
router.post(
  '/:id/dispatch',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await notificationsService.dispatchNotification(
        req.params.id as string,
        req.body || {},
        {
          userId: req.user!.userId,
          email: req.user!.email,
        }
      );
      sendSuccess(res, data, 'Notification dispatch processed');
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/notifications/:id/retry
router.post(
  '/:id/retry',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await notificationsService.retryFailedNotification(
        req.params.id as string,
        req.body || {},
        {
          userId: req.user!.userId,
          email: req.user!.email,
        }
      );
      sendSuccess(res, data, 'Failed notification retried');
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/notifications/preferences/:memberId
router.get(
  '/preferences/:memberId',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await notificationsService.getPreferences(req.params.memberId as string);
      sendSuccess(res, data, 'User notification preferences retrieved');
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/notifications/preferences/:memberId
router.put(
  '/preferences/:memberId',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await notificationsService.updatePreferences(
        req.params.memberId as string,
        req.body,
        {
          userId: req.user!.userId,
          email: req.user!.email,
        }
      );
      sendSuccess(res, data, 'User notification preferences updated with audit log');
    } catch (err) {
      next(err);
    }
  }
);

export default router;

