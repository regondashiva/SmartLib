import { Request, Response, NextFunction } from 'express';
import { migrationService } from './migration.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { ValidationError } from '../../utils/errors.js';
import { CreateBatchInput, ListBatchesQuery, PreviewQuery } from './migration.schema.js';

export class MigrationController {
  /**
   * Upload and stage file (CSV, XLSX, JSON)
   * POST /api/v1/migrations/upload
   */
  async uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new Error('User context missing from authenticated request'));
      }
      if (!req.file) {
        return next(new ValidationError('No file uploaded. Please provide a CSV or Excel file.'));
      }

      let mapping: Record<string, string> | undefined;
      if (req.body.mapping) {
        try {
          mapping = typeof req.body.mapping === 'string'
            ? JSON.parse(req.body.mapping)
            : req.body.mapping;
        } catch {
          return next(new ValidationError('Invalid JSON in column mapping parameter'));
        }
      }

      const result = await migrationService.uploadAndStageFile(
        req.file.buffer,
        req.file.originalname,
        req.user.userId,
        {
          batchName: req.body.batchName,
          mapping,
        }
      );

      sendSuccess(res, result, 'File uploaded and records staged successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Direct JSON batch staging
   * POST /api/v1/migrations
   */
  async createBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new Error('User context missing from authenticated request'));
      }
      const input: CreateBatchInput = req.body;
      const batch = await migrationService.createBatch(input, req.user.userId);
      sendSuccess(res, batch, 'Migration batch created and records staged', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate staged records
   * POST /api/v1/migrations/:id/validate
   */
  async validateBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const result = await migrationService.validateBatch(id, req.user?.userId);
      sendSuccess(res, result, 'Batch records validated and duplicates checked', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dry-run simulation without modifying catalog
   * POST /api/v1/migrations/:id/dry-run
   */
  async dryRunBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const result = await migrationService.dryRunBatch(id, req.user?.userId);
      sendSuccess(res, result, 'Dry run completed successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Preview records in batch
   * GET /api/v1/migrations/:id/preview
   */
  async previewBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const query = req.query as unknown as PreviewQuery;
      const limit = query.limit || 50;
      const filterStatus = query.status || 'ALL';
      const result = await migrationService.previewBatch(id, limit, filterStatus);
      sendSuccess(res, result, 'Batch preview retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Commit validated batch to production catalog
   * POST /api/v1/migrations/:id/commit
   */
  async commitBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new Error('User context missing from authenticated request'));
      }
      const id = req.params['id'] as string;
      const result = await migrationService.commitBatch(id, req.user.userId);
      sendSuccess(res, result, 'Migration batch committed into library catalog', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Roll back a committed batch
   * POST /api/v1/migrations/:id/rollback
   */
  async rollbackBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new Error('User context missing from authenticated request'));
      }
      const id = req.params['id'] as string;
      const result = await migrationService.rollbackBatch(id, req.user.userId);
      sendSuccess(res, result, 'Migration batch rolled back safely', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get row-level validation errors (JSON or CSV)
   * GET /api/v1/migrations/:id/errors
   */
  async getErrors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const format = req.query['format'] === 'csv' || req.headers['accept'] === 'text/csv' ? 'csv' : 'json';
      const errors = await migrationService.getErrors(id, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="migration-errors-${id}.csv"`);
        res.status(200).send(errors);
        return;
      }

      sendSuccess(res, errors, 'Validation errors retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Legacy CSV export endpoint
   * GET /api/v1/migrations/:id/errors/export
   */
  async exportErrorsCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const csv = await migrationService.getErrors(id, 'csv');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="migration-errors-${id}.csv"`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List migration batches
   * GET /api/v1/migrations
   */
  async listBatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListBatchesQuery;
      const result = await migrationService.listBatches(query);
      sendSuccess(res, result.items, 'Migration batches retrieved', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get migration batch detail by ID
   * GET /api/v1/migrations/:id
   */
  async getBatchById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const batch = await migrationService.getBatchById(id);
      sendSuccess(res, batch, 'Migration batch details retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const migrationController = new MigrationController();
