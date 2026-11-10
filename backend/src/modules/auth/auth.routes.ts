import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { loginSchema } from './auth.schema.js';

const router = Router();

const loginRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 15,
  keyPrefix: 'auth-login',
});

// POST /api/v1/auth/login
router.post(
  '/login',
  loginRateLimiter,
  validateRequest({ body: loginSchema }),
  (req, res, next) => authController.login(req, res, next)
);

// GET /api/v1/auth/me (Protected)
router.get(
  '/me',
  authenticate,
  (req, res, next) => authController.getMe(req, res, next)
);

export default router;

