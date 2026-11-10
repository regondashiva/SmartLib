import { Router, Request, Response, NextFunction } from 'express';
import { labelsService } from './labels.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/apiResponse.js';

const router = Router();

router.use(authenticate);
router.use(requireRole(['ADMIN', 'LIBRARIAN']));

// POST /api/v1/labels/assign-barcode
router.post('/assign-barcode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await labelsService.assignBarcode(req.body, {
      userId: req.user!.userId,
      email: req.user!.email,
    });
    sendSuccess(res, result, 'Unique barcode assigned to physical copy', 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/labels/preview
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preview = await labelsService.generatePreview(req.body || {});
    sendSuccess(res, preview, 'Barcode and spine-label preview generated', 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/labels/pdf
router.post('/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename, pdfBuffer } = await labelsService.generatePdf(req.body || {});
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;

