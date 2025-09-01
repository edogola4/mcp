import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config';
import { TooManyRequestsError } from '../utils/errors';

// Default rate limiting values
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // 100 requests per window per IP

/**
 * Rate limiting middleware to prevent abuse of the API
 * Uses in-memory store by default (use Redis in production)
 */
export const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || RATE_LIMIT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_MAX) || RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and API docs in development
    if (process.env.NODE_ENV === 'development' && 
        (req.path === '/health' || req.path.startsWith('/api-docs'))) {
      return true;
    }
    return false;
  },
  handler: (req: Request, res: Response, next: NextFunction, options: any) => {
    next(new TooManyRequestsError(
      'Too many requests, please try again later',
      {
        retryAfter: (options.windowMs / 1000).toString(),
        limit: options.max,
        windowMs: options.windowMs
      }
    ));
  }
});
