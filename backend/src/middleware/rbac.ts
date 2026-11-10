import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export function requireRole(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
}

export function requirePermission(requiredPermission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // ADMIN role has implicit superuser privileges across all modules
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (!req.user.permissions || !req.user.permissions.includes(requiredPermission)) {
      return next(
        new ForbiddenError(
          `Access denied. Required permission: '${requiredPermission}'`
        )
      );
    }

    next();
  };
}

