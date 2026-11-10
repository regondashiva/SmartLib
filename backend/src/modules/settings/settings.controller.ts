import { Request, Response, NextFunction } from 'express';
import { settingsService } from './settings.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { SettingsHistoryQuery, UpdateSettingsInput } from './settings.schema.js';
import { UnauthorizedError } from '../../utils/errors.js';

export class SettingsController {
  async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      sendSuccess(res, settings, 'Institutional system settings retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authenticated administrator required');
      }

      const body = req.body as UpdateSettingsInput;
      const updated = await settingsService.updateSettings(
        body,
        req.user.userId,
        req.user.email,
        req.ip,
        req.headers['user-agent']
      );

      sendSuccess(res, updated, 'Institutional system settings updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as SettingsHistoryQuery;
      const history = await settingsService.getSettingsHistory(query);
      sendSuccess(res, history, 'Settings configuration history retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();

