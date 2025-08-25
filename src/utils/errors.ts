import { StatusCodes } from 'http-status-codes';

/**
 * Base error class for MCP server errors
 */
export class MCPError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 4xx Client Errors

/**
 * 400 Bad Request - The request could not be understood or was missing required parameters.
 */
export class BadRequestError extends MCPError {
  constructor(message: string = 'Bad Request', details?: any) {
    super(message, StatusCodes.BAD_REQUEST, 'BAD_REQUEST', details);
  }
}

/**
 * 401 Unauthorized - Authentication failed or user doesn't have permissions for the requested operation.
 */
export class UnauthorizedError extends MCPError {
  constructor(message: string = 'Unauthorized', details?: any) {
    super(message, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', details);
  }
}

/**
 * 403 Forbidden - The request was valid, but the server is refusing action.
 */
export class ForbiddenError extends MCPError {
  constructor(message: string = 'Forbidden', details?: any) {
    super(message, StatusCodes.FORBIDDEN, 'FORBIDDEN', details);
  }
}

/**
 * 404 Not Found - The requested resource could not be found.
 */
export class NotFoundError extends MCPError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, StatusCodes.NOT_FOUND, 'NOT_FOUND', details);
  }
}

/**
 * 409 Conflict - The request could not be processed because of conflict in the current state of the resource.
 */
export class ConflictError extends MCPError {
  constructor(message: string = 'Resource already exists', details?: any) {
    super(message, StatusCodes.CONFLICT, 'CONFLICT', details);
  }
}

/**
 * 422 Unprocessable Entity - The request was well-formed but was unable to be followed due to semantic errors.
 */
export class ValidationError extends MCPError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', details);
  }
}

/**
 * 429 Too Many Requests - The user has sent too many requests in a given amount of time.
 */
export class TooManyRequestsError extends MCPError {
  constructor(message: string = 'Too many requests', details?: any) {
    super(message, StatusCodes.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS', details);
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends TooManyRequestsError {
  constructor(
    message: string = 'Too many requests, please try again later',
    details?: {
      retryAfter?: string | number;
      limit?: number;
      current?: number;
      resetTime?: Date;
    }
  ) {
    super(message, {
      ...details,
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }
}

// 5xx Server Errors

/**
 * 500 Internal Server Error - A generic error message, given when an unexpected condition was encountered.
 */
export class InternalServerError extends MCPError {
  constructor(message: string = 'Internal Server Error', details?: any) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR', details);
  }
}

/**
 * 503 Service Unavailable - The server is not ready to handle the request.
 */
export class ServiceUnavailableError extends MCPError {
  constructor(message: string = 'Service Unavailable', details?: any) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', details);
  }
}

// Database Errors

/**
 * Base database error class
 */
export class DatabaseError extends MCPError {
  constructor(message: string = 'Database Error', details?: any) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, 'DATABASE_ERROR', details);
  }
}

/**
 * Database validation error
 */
export class DatabaseValidationError extends DatabaseError {
  constructor(message: string = 'Database Validation Error', details?: any) {
    super(message, {
      ...(details || {}),
      statusCode: StatusCodes.BAD_REQUEST,
      code: 'DATABASE_VALIDATION_ERROR',
    });
  }
}

// File System Errors

/**
 * Base file system error class
 */
export class FileSystemError extends MCPError {
  constructor(message: string = 'File System Error', details?: any) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, 'FILE_SYSTEM_ERROR', details);
  }
}

/**
 * File not found error
 */
export class FileNotFoundError extends FileSystemError {
  constructor(message: string = 'File not found', details?: any) {
    super(message, {
      ...(details || {}),
      statusCode: StatusCodes.NOT_FOUND,
      code: 'FILE_NOT_FOUND',
    });
  }
}

/**
 * File permission error
 */
export class FilePermissionError extends FileSystemError {
  constructor(message: string = 'Permission denied', details?: any) {
    super(message, {
      ...(details || {}),
      statusCode: StatusCodes.FORBIDDEN,
      code: 'PERMISSION_DENIED',
    });
  }
}

// Authentication & Authorization

/**
 * Authentication error
 */
export class AuthenticationError extends MCPError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(message, StatusCodes.UNAUTHORIZED, 'AUTHENTICATION_FAILED', details);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends MCPError {
  constructor(message: string = 'Insufficient permissions', details?: any) {
    super(message, StatusCodes.FORBIDDEN, 'AUTHORIZATION_FAILED', details);
  }
}

/**
 * Token expired error
 */
export class TokenExpiredError extends AuthenticationError {
  constructor(message: string = 'Token has expired', details?: any) {
    super(message, {
      ...(details || {}),
      statusCode: StatusCodes.UNAUTHORIZED,
      code: 'TOKEN_EXPIRED',
    });
  }
}

// API Errors

/**
 * Base API error class
 */
export class ApiError extends MCPError {
  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = 'API_ERROR',
    details?: any
  ) {
    super(message, statusCode, code, details);
  }
}

// Utility Functions

/**
 * Handles errors and returns a standardized MCPError
 */
export const handleError = (error: unknown): MCPError => {
  if (error instanceof MCPError) {
    return error;
  }

  if (error instanceof Error) {
    return new MCPError(
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR,
      'UNKNOWN_ERROR',
      { stack: error.stack }
    );
  }

  return new MCPError(
    'An unknown error occurred',
    StatusCodes.INTERNAL_SERVER_ERROR,
    'UNKNOWN_ERROR',
    { originalError: error }
  );
};

/**
 * Type guard for MCPError
 */
export const isMCPError = (error: unknown): error is MCPError => {
  return error instanceof MCPError;
};

/**
 * Error handler utility for converting errors to appropriate responses
 */
export function errorHandler(error: Error) {
  // If the error is already an MCPError, return it as is
  if (error instanceof MCPError) {
    return error;
  }

  // Handle common error types
  if (error.name === 'ValidationError') {
    return new BadRequestError('Validation Error', { details: error.message });
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return new UnauthorizedError('Invalid or expired token');
  }

  if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'MongoError') {
    // Handle database unique constraint violations
    if ('code' in error && error.code === 11000) {
      return new ConflictError('Resource already exists');
    }
  }

  // Default to internal server error for unhandled errors
  return new InternalServerError(
    'An unexpected error occurred',
    process.env.NODE_ENV === 'development' ? { error: error.message, stack: error.stack } : undefined
  );
};
