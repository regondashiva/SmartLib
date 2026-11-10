import { Request, Response, NextFunction } from 'express';
import { rfidService } from './rfid.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class RFIDController {
  async getDevices(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await rfidService.getDevices();
      sendSuccess(res, result, 'RFID device status list retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const epc = typeof req.query.epc === 'string' ? req.query.epc : undefined;
      const result = await rfidService.getTags(page, limit, epc);
      sendSuccess(res, result.items, 'RFID tags inventory retrieved', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async assignTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user
        ? { userId: req.user.userId, email: req.user.email, ipAddress: req.ip }
        : undefined;
      const result = await rfidService.assignTag(req.body, actor);
      sendSuccess(res, result, 'RFID tag encoded and assigned successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async reassignTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user
        ? { userId: req.user.userId, email: req.user.email, ipAddress: req.ip }
        : undefined;
      const result = await rfidService.reassignTag(req.params.id as string, req.body, actor);
      sendSuccess(res, result, 'RFID tag reassigned successfully with audit log', 200);
    } catch (error) {
      next(error);
    }
  }

  async recordGateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user
        ? { userId: req.user.userId, email: req.user.email, ipAddress: req.ip }
        : undefined;
      const result = await rfidService.recordGateEvent(req.body, actor);
      sendSuccess(res, result, 'Security gate event recorded', 201);
    } catch (error) {
      next(error);
    }
  }

  async reconcileInventorySession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = {
        userId: req.user!.userId,
        email: req.user!.email,
        ipAddress: req.ip,
      };
      const result = await rfidService.reconcileInventorySession(req.body, actor);
      sendSuccess(res, result, 'RFID handheld inventory session reconciled', 201);
    } catch (error) {
      next(error);
    }
  }

  async getGateEventCctvSnapshot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await rfidService.getGateEventCctvSnapshot(req.params.id as string);
      sendSuccess(res, result, 'Mock CCTV synthetic snapshot retrieved for gate event', 200);
    } catch (error) {
      next(error);
    }
  }

  async recordFootfallEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user
        ? { userId: req.user.userId, email: req.user.email }
        : undefined;
      const result = await rfidService.recordFootfallEvent(req.body, actor);
      sendSuccess(res, result, 'Footfall entry/exit event recorded', 201);
    } catch (error) {
      next(error);
    }
  }

  async getFootfallSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await rfidService.getFootfallSummary();
      sendSuccess(res, result, 'Footfall entry/exit summary retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const rfidController = new RFIDController();
