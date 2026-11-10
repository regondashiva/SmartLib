import { Router } from 'express';
import { membersController } from './members.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import {
  getMembersQuerySchema,
  memberIdParamSchema,
  smartCardUidParamSchema,
} from './members.schema.js';

const router = Router();

// Protected routes (Staff / Admin authentication)
router.use(authenticate);

// GET /api/v1/members
router.get(
  '/',
  validateRequest({ query: getMembersQuerySchema }),
  (req, res, next) => membersController.getMembers(req, res, next)
);

// GET /api/v1/members/card/:uid
router.get(
  '/card/:uid',
  validateRequest({ params: smartCardUidParamSchema }),
  (req, res, next) => membersController.getMemberByCard(req, res, next)
);

// GET /api/v1/members/:id
router.get(
  '/:id',
  validateRequest({ params: memberIdParamSchema }),
  (req, res, next) => membersController.getMemberById(req, res, next)
);

export default router;

