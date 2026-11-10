import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse.js';

export function notFoundHandler(req: Request, res: Response): Response {
  return sendError(
    res,
    `Route ${req.method} ${req.originalUrl} not found`,
    404
  );
}

