import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse.js';

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

/**
 * Lightweight sliding-window rate limiter middleware to protect authentication
 * and high-impact administrative endpoints against brute-force abuse.
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}) {
  const { windowMs, maxRequests, keyPrefix = 'global' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Allow integration test suites to run without artificial throttling unless explicitly testing rate limit header
    const forceRateLimitTest = req.headers['x-enforce-rate-limit'] === 'true';
    if (process.env.NODE_ENV === 'test' && !forceRateLimitTest) {
      next();
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = {
        count: 1,
        resetAt: now + windowMs,
      };
      buckets.set(key, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, maxRequests - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      sendError(
        res,
        'Too many authentication or administrative requests from this IP. Please wait before retrying.',
        429
      );
      return;
    }

    next();
  };
}

