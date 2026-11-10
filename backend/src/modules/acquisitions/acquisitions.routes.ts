import { Router, Request, Response, NextFunction } from 'express';
import { acquisitionsService } from './acquisitions.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/apiResponse.js';

const router = Router();

router.use(authenticate);
router.use(requireRole(['ADMIN', 'LIBRARIAN']));

// GET /api/v1/acquisitions/suppliers
router.get('/suppliers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const suppliers = await acquisitionsService.getSuppliers();
    sendSuccess(res, suppliers, 'Suppliers retrieved successfully', 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/acquisitions/suppliers
router.post('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await acquisitionsService.createSupplier(req.body, {
      userId: req.user!.userId,
      email: req.user!.email,
    });
    sendSuccess(res, created, 'Supplier created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/acquisitions/requests
router.get('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const requests = await acquisitionsService.getRequests(status);
    sendSuccess(res, requests, 'Acquisition requests retrieved successfully', 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/acquisitions/requests
router.post('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await acquisitionsService.createRequest(req.body, {
      userId: req.user!.userId,
      email: req.user!.email,
    });
    sendSuccess(res, created, 'Acquisition request created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/acquisitions/orders
router.get('/orders', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await acquisitionsService.getOrders();
    sendSuccess(res, orders, 'Purchase orders retrieved successfully', 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/acquisitions/orders
router.post('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await acquisitionsService.createPurchaseOrder(req.body, {
      userId: req.user!.userId,
      email: req.user!.email,
    });
    sendSuccess(res, created, 'Purchase order created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/acquisitions/orders/:id/receive
router.post('/orders/:id/receive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await acquisitionsService.receivePurchaseOrder(req.params.id as string, req.body, {
      userId: req.user!.userId,
      email: req.user!.email,
    });
    sendSuccess(res, result, 'Purchase order items received and catalogued into inventory', 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/acquisitions/reports
router.get('/reports', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await acquisitionsService.getAcquisitionReports();
    sendSuccess(res, report, 'Acquisition summary report generated', 200);
  } catch (err) {
    next(err);
  }
});

export default router;

