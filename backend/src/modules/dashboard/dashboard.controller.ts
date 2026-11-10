import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class DashboardController {
  async getSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await dashboardService.getDashboardSummary();
      sendSuccess(res, summary, 'Dashboard summary metrics retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();

