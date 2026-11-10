import { Router, Request, Response, NextFunction } from 'express';
import { adaptersService, AdapterCategory } from './adapters.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/apiResponse.js';

const router = Router();

router.use(authenticate);

// GET /api/v1/adapters/devices — List all 9 device-neutral hardware/service adapters
router.get('/devices', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = adaptersService.getAllDeviceAdapters();
    sendSuccess(res, result, 'Device-neutral adapter registry retrieved', 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/adapters/devices/:adapterType/command — Execute adapter command
router.post(
  '/devices/:adapterType/command',
  requireRole(['ADMIN', 'LIBRARIAN', 'RFID_OPERATOR']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adapterType = (req.params.adapterType as string).toUpperCase() as AdapterCategory;
      const command = req.body.command as string;
      const result = await adaptersService.executeDeviceCommand(
        adapterType,
        command,
        req.body.payload || {}
      );
      sendSuccess(res, result, 'Adapter command executed', 200);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/adapters/ncip/examples
router.get('/ncip/examples', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const examples = adaptersService.getNcipExamples();
    sendSuccess(res, examples, 'NCIP 2.0 protocol examples retrieved', 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/adapters/ncip
router.post(
  '/ncip',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adaptersService.processNcipMessage(req.body, req.user?.userId);
      sendSuccess(res, result, 'NCIP 2.0 adapter message processed', 200);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/adapters/sip2/examples
router.get('/sip2/examples', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const examples = adaptersService.getSip2Examples();
    sendSuccess(res, examples, '3M SIP2 protocol examples retrieved', 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/adapters/sip2
router.post(
  '/sip2',
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawMessage = req.body.message as string;
      const result = await adaptersService.processSip2Message(rawMessage, req.user?.userId);
      sendSuccess(res, result, '3M SIP2 protocol message processed', 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

