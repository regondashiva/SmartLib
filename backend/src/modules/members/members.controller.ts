import { Request, Response, NextFunction } from 'express';
import { membersService } from './members.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { GetMembersQuery } from './members.schema.js';

export class MembersController {
  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetMembersQuery;
      const result = await membersService.getMembers(query);
      sendSuccess(res, result.items, 'Members list retrieved', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getMemberById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const member = await membersService.getMemberById(id);
      sendSuccess(res, member, 'Member profile retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getMemberByCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const uid = req.params.uid as string;
      const member = await membersService.getMemberBySmartCardUid(uid);
      sendSuccess(res, member, 'Member retrieved via Smart Card UID', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const membersController = new MembersController();

