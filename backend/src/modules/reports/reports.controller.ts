import { Request, Response, NextFunction } from 'express';
import { reportsService } from './reports.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { ExportReportQuery, ReportFilterQuery } from './reports.schema.js';

export class ReportsController {
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const summary = await reportsService.getDashboardReport(query);
      sendSuccess(res, summary, 'Institutional dashboard report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    return this.getDashboard(req, res, next);
  }

  async getCirculation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const data = await reportsService.getCirculationReport(query);
      sendSuccess(res, data, 'Circulation report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getOverdue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const data = await reportsService.getOverdueReport(query, req.user?.role);
      sendSuccess(res, data, 'Overdue loans report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const data = await reportsService.getInventoryReport(query);
      sendSuccess(res, data, 'Inventory reconciliation report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const data = await reportsService.getMembersReport(query, req.user?.role);
      sendSuccess(res, data, 'Member activity report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getFines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const data = await reportsService.getFinesReport(query);
      sendSuccess(res, data, 'Fine collection report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getRfid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const data = await reportsService.getRfidOperationsReport(query);
      sendSuccess(res, data, 'RFID operations report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getSecurityGates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const data = await reportsService.getSecurityGatesReport(query);
      sendSuccess(res, data, 'Security gate report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getOperators(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const data = await reportsService.getOperatorsReport(query);
      sendSuccess(res, data, 'Operator activity report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getMigrations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportFilterQuery;
      const data = await reportsService.getMigrationsReport(query);
      sendSuccess(res, data, 'Migration batches report retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async exportReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ExportReportQuery;
      const result = await reportsService.generateReport(query, req.user?.email, req.user?.role);

      if (result.type === 'application/pdf') {
        const buffer = result.data as Buffer;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.status(200).end(buffer);
        return;
      }

      if (result.type === 'text/csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.status(200).send(result.data);
        return;
      }

      sendSuccess(res, (result as { data: unknown }).data, 'Report dataset generated', 200);
    } catch (error) {
      next(error);
    }
  }

  async exportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.query = { ...req.query, format: 'pdf' };
    return this.exportReport(req, res, next);
  }

  async exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.query = { ...req.query, format: 'csv' };
    return this.exportReport(req, res, next);
  }
}

export const reportsController = new ReportsController();
