import { Request, Response, NextFunction } from 'express';
import { auditService } from './audit.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { GetAuditLogsQuery } from './audit.schema.js';

export class AuditController {
  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetAuditLogsQuery;
      const result = await auditService.getAuditLogs(query);
      sendSuccess(res, result.items, 'Audit logs retrieved', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();

