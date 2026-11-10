import { Request, Response, NextFunction } from 'express';
import { circulationService } from './circulation.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import {
  GetCirculationsQuery,
  IssueBookInput,
  ReturnLoanInput,
  RenewLoanInput,
  PayFineInput,
  WaiveFineInput,
  GetFinesQuery,
} from './circulation.schema.js';

export class CirculationController {
  async getCirculations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetCirculationsQuery;
      const result = await circulationService.getCirculations(query);
      sendSuccess(res, result.items, 'Circulation transactions retrieved', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getCirculationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const result = await circulationService.getCirculationById(id);
      sendSuccess(res, result, 'Circulation record retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async issueBook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new Error('User context missing from authenticated request'));
      }
      const input: IssueBookInput = req.body;
      const result = await circulationService.issueBook(input, req.user.userId);
      sendSuccess(res, result, 'Book checked out successfully and EAS disarmed', 201);
    } catch (error) {
      next(error);
    }
  }

  async returnLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: ReturnLoanInput = req.body;
      const result = await circulationService.returnLoan(input, req.user?.userId);
      sendSuccess(res, result, 'Book returned successfully and EAS re-armed', 200);
    } catch (error) {
      next(error);
    }
  }

  async renewLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: RenewLoanInput = req.body;
      const result = await circulationService.renewLoan(input, req.user?.userId);
      sendSuccess(res, result, 'Loan renewed successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getFines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetFinesQuery;
      const result = await circulationService.getFines(query);
      sendSuccess(res, result.items, 'Fines retrieved', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async payFine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: PayFineInput = req.body;
      const result = await circulationService.payFine(input, req.user?.userId);
      sendSuccess(res, result, result.message, 200);
    } catch (error) {
      next(error);
    }
  }

  async waiveFine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new Error('User context missing'));
      }
      const input: WaiveFineInput = req.body;
      const result = await circulationService.waiveFine(input, req.user.userId);
      sendSuccess(res, result, result.message, 200);
    } catch (error) {
      next(error);
    }
  }

  async dueDateEnquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await circulationService.dueDateEnquiry({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        accessionNumber:
          typeof req.query.accessionNumber === 'string' ? req.query.accessionNumber : undefined,
        cardNumber: typeof req.query.cardNumber === 'string' ? req.query.cardNumber : undefined,
        barcode: typeof req.query.barcode === 'string' ? req.query.barcode : undefined,
      });
      sendSuccess(res, result, 'Due-date enquiry results retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const circulationController = new CirculationController();
