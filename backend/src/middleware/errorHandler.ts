import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): Response {
  // Operational custom errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, {
        stack: err.stack,
        errors: err.errors,
      });
    } else {
      logger.warn(`[${req.method}] ${req.originalUrl} - ${err.message}`, {
        errors: err.errors,
      });
    }
    return sendError(res, err.message, err.statusCode, err.errors);
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn(`Prisma error [${err.code}] on ${req.method} ${req.originalUrl}: ${err.message}`);

    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(', ')
        : 'unique field';
      return sendError(res, `A record with this ${target} already exists`, 409);
    }

    if (err.code === 'P2025') {
      return sendError(res, 'Record not found in database', 404);
    }

    return sendError(res, 'Database operation failed', 400, {
      code: err.code,
    });
  }

  // Malformed JSON syntax error
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    return sendError(res, 'Malformed JSON payload in request body', 400);
  }

  // Unhandled internal server errors
  logger.error(`Unhandled error on [${req.method}] ${req.originalUrl}: ${err.message}`, {
    stack: err.stack,
  });

  const responseMessage =
    env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  return sendError(
    res,
    responseMessage,
    500,
    env.NODE_ENV === 'production' ? undefined : { stack: err.stack }
  );
}

