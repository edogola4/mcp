import { Request as ExpressRequest, Response, NextFunction } from 'express';
import { Logger } from 'winston';
import { 
  MCPError, 
  DatabaseError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  RateLimitError,
  BadRequestError,
  TooManyRequestsError
} from './errors';

// Define AuthUser type
type AuthUser = {
  id: string;
  [key: string]: any;
};

// Extend the Express Request type
declare module 'express' {
  interface Request {
    id?: string;
    user?: AuthUser;
  }
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: AuthUser;
    }
  }
}

type Request = ExpressRequest;

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
    
    // Handle MCPError and its subclasses
    if (err instanceof MCPError) {
      const statusCode = err.statusCode || 500;
      const response: ErrorResponse = {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        },
        requestId
      };

      // Log the error with appropriate level
      const logContext = {
        requestId,
        status: statusCode,
        code: err.code,
        message: err.message,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
        userAgent: req.get('user-agent'),
        ...(err.details && { details: err.details })
      };

      if (statusCode >= 500) {
        logger.error('Server error', {
          ...logContext,
          stack: err.stack,
          error: err
        });
      } else if (statusCode >= 400) {
        logger.warn('Client error', logContext);
      } else {
        logger.info('Informational', logContext);
      }

      return res.status(statusCode).json(response);
    }

    // Handle validation errors
    if (err.name === 'ValidationError' || err.name === 'ValidatorError' || err.name === 'ZodError') {
      const validationError = new ValidationError('Validation failed', {
        errors: err.errors || err.details || err.message
      });
      
      return next(validationError);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      const authError = new AuthenticationError(
        err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token',
        { cause: err }
      );
      return next(authError);
    }

    // Handle rate limiting
    if (err.status === 429) {
      const rateLimitError = new TooManyRequestsError('Too many requests, please try again later', {
        retryAfter: err.retryAfter,
        limit: err.limit,
        current: err.current,
        resetTime: err.resetTime
      });
      return next(rateLimitError);
    }

    // Handle 404 errors
    if (err.status === 404) {
      const notFoundError = new NotFoundError('The requested resource was not found', {
        path: req.path,
        method: req.method
      });
      return next(notFoundError);
    }

    // Handle database errors
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      // Handle duplicate key errors
      if (err.code === 11000) {
        const duplicateKeyError = new DatabaseError('A resource with this value already exists', {
          code: 'DUPLICATE_KEY',
          statusCode: 409,
          keyPattern: err.keyPattern || {},
          keyValue: err.keyValue || {}
        });
        return next(duplicateKeyError);
      }

      // Handle other database errors
      const dbError = new DatabaseError('A database error occurred', {
        code: 'DATABASE_ERROR',
        statusCode: 500,
        error: process.env.NODE_ENV === 'development' ? err : undefined
      });
      return next(dbError);
    }

    // Default error handler
    const internalError = new MCPError(
      'An unexpected error occurred',
      500,
      'INTERNAL_SERVER_ERROR',
      process.env.NODE_ENV === 'development' 
        ? { message: err.message, stack: err.stack }
        : undefined
    );
    
    // Log the full error in development, sanitized in production
    logger.error('Unhandled error', {
      requestId,
      status: 500,
      code: 'UNHANDLED_ERROR',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        error: err
      }),
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });

    return next(internalError);
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
