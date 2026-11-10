import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { LoginInput } from './auth.schema.js';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: LoginInput = req.body;
      const metadata = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const result = await authService.login(input, metadata);
      sendSuccess(res, result, 'Authentication successful', 200);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new Error('User context missing from authenticated request'));
      }

      const profile = await authService.getCurrentUser(req.user.userId);
      sendSuccess(res, profile, 'User profile retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

