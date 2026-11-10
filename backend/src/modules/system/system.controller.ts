import { Request, Response, NextFunction } from 'express';
import { systemLifecycleService } from './system.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { UnauthorizedError } from '../../utils/errors.js';
import {
  ValidatePackageInput,
  CreateBackupInput,
  VerifyBackupRestoreInput,
  ExecuteUpdateInput,
  ExecuteRollbackInput,
  SystemHistoryQuery,
} from './system.schema.js';

export class SystemLifecycleController {
  async getVersionAndStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await systemLifecycleService.getVersionAndStatus();
      sendSuccess(res, status, 'System version, update state, and deployment status retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async validatePackage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as ValidatePackageInput;
      const validation = await systemLifecycleService.validateUpdatePackage(body);
      sendSuccess(
        res,
        validation,
        validation.valid
          ? 'Offline update package validated successfully'
          : 'Offline update package failed validation checks',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  async createBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authenticated administrator required');
      }
      const body = req.body as CreateBackupInput;
      const backup = await systemLifecycleService.createBackup(
        body,
        req.user.userId,
        req.user.email,
        req.ip
      );
      sendSuccess(res, backup, 'Database backup created and SHA-256 verified', 201);
    } catch (error) {
      next(error);
    }
  }

  async verifyOrRestoreBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authenticated administrator required');
      }
      const body = req.body as VerifyBackupRestoreInput;
      const result = await systemLifecycleService.verifyOrRestoreBackup(
        body,
        req.user.userId,
        req.user.email,
        req.ip
      );
      sendSuccess(res, result, 'Backup restore verification completed successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async executeUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authenticated administrator required');
      }
      const body = req.body as ExecuteUpdateInput;
      const result = await systemLifecycleService.executeControlledUpdate(
        body,
        req.user.userId,
        req.user.email,
        req.ip
      );
      sendSuccess(
        res,
        result,
        result.status === 'COMPLETED'
          ? 'Application update completed and verified'
          : 'Application update failed and automatically rolled back to last known-good version',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  async executeRollback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authenticated administrator required');
      }
      const body = req.body as ExecuteRollbackInput;
      const result = await systemLifecycleService.executeRollback(
        body,
        req.user.userId,
        req.user.email,
        req.ip
      );
      sendSuccess(res, result, 'System rolled back to last known-good version', 200);
    } catch (error) {
      next(error);
    }
  }

  async getDiagnostics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const diagnostics = await systemLifecycleService.runDiagnostics();
      sendSuccess(res, diagnostics, 'Post-update and recovery diagnostics executed', 200);
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as SystemHistoryQuery;
      const history = await systemLifecycleService.getUpdateHistory(query);
      sendSuccess(res, history, 'System update and backup operation history retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const systemLifecycleController = new SystemLifecycleController();

