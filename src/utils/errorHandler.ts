import { Request as ExpressRequest, Response, NextFunction } from 'express';

// Extend the Express Request type to include the id property
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

type Request = ExpressRequest;
import { Logger } from 'winston';
import { MCPError } from './errors';

interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  requestId?: string;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (logger: Logger) => {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const requestId = req.id as string;
    
    // Handle MCPError
    if (err instanceof MCPError) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details
        },
        requestId
      };

      logger.warn('Request failed', {
        requestId,
        status: err.statusCode,
        code: err.code,
        message: err.message,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: err.details
      });

      return res.status(err.statusCode).json(response);
    }

    // Handle validation errors
    if (err.name === 'ValidationError' || err.name === 'ValidatorError') {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: err.message
        },
        requestId
      };

      logger.warn('Validation failed', {
        requestId,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: err.message,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(400).json(response);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
          details: err.message
        },
        requestId
      };

      logger.warn('Authentication failed', {
        requestId,
        status: 401,
        code: 'INVALID_TOKEN',
        message: err.message,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(401).json(response);
    }

    // Handle rate limiting
    if (err.status === 429) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.',
          details: {
            retryAfter: err.retryAfter
          }
        },
        requestId
      };

      logger.warn('Rate limit exceeded', {
        requestId,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(429).json(response);
    }

    // Handle 404 errors
    if (err.status === 404) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.'
        },
        requestId
      };

      logger.warn('Resource not found', {
        requestId,
        status: 404,
        code: 'NOT_FOUND',
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(404).json(response);
    }

    // Handle database errors
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      let status = 500;
      let code = 'DATABASE_ERROR';
      let message = 'A database error occurred';

      // Handle duplicate key errors
      if (err.code === 11000) {
        status = 409;
        code = 'DUPLICATE_KEY';
        message = 'A resource with this value already exists';
      }

      const response: ErrorResponse = {
        success: false,
        error: {
          code,
          message,
          details: process.env.NODE_ENV === 'development' ? err.message : undefined
        },
        requestId
      };

      logger.error('Database error', {
        requestId,
        status,
        code,
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        error: err
      });

      return res.status(status).json(response);
    }

    // Default error handler
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      },
      requestId
    };

    // Log the error
    logger.error('Unexpected error', {
      requestId,
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      error: err
    });

    // Return error response
    res.status(500).json(response);
  };
};

/**
 * 404 handler middleware
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`
    },
    requestId: req.id as string
  };

  res.status(404).json(response);
};

/**
 * Async error handler wrapper for Express routes
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Request logger middleware
 */
export const requestLogger = (logger: Logger) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = req.id as string;

    // Log request
    logger.info('Request received', {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      logger.info('Response sent', {
        requestId,
        status: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    });

    next();
  };
};
