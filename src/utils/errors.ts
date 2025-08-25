/**
 * Base error class for MCP server errors
 */
export class MCPError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 400 Bad Request - The request could not be understood or was missing required parameters.
 */
export class BadRequestError extends MCPError {
  constructor(message: string = 'Bad Request', details?: any) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

/**
 * 401 Unauthorized - Authentication failed or user doesn't have permissions for the requested operation.
 */
export class UnauthorizedError extends MCPError {
  constructor(message: string = 'Unauthorized', details?: any) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

/**
 * 403 Forbidden - Authentication succeeded but the authenticated user doesn't have the necessary permissions.
 */
export class ForbiddenError extends MCPError {
  constructor(message: string = 'Forbidden', details?: any) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

/**
 * 404 Not Found - The requested resource doesn't exist.
 */
export class NotFoundError extends MCPError {
  constructor(message: string = 'Not Found', details?: any) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

/**
 * 409 Conflict - The request conflicts with the current state of the target resource.
 */
export class ConflictError extends MCPError {
  constructor(message: string = 'Conflict', details?: any) {
    super(message, 409, 'CONFLICT', details);
  }
}

/**
 * 422 Unprocessable Entity - The request was well-formed but was unable to be followed due to semantic errors.
 */
export class UnprocessableEntityError extends MCPError {
  constructor(message: string = 'Unprocessable Entity', details?: any) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
}

/**
 * 429 Too Many Requests - The user has sent too many requests in a given amount of time.
 */
export class RateLimitExceededError extends MCPError {
  constructor(message: string = 'Too Many Requests', details?: any) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
}

/**
 * 500 Internal Server Error - A generic error message, given when an unexpected condition was encountered.
 */
export class InternalServerError extends MCPError {
  constructor(message: string = 'Internal Server Error', details?: any) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

/**
 * 501 Not Implemented - The server either does not recognize the request method, or it lacks the ability to fulfill the request.
 */
export class NotImplementedError extends MCPError {
  constructor(message: string = 'Not Implemented', details?: any) {
    super(message, 501, 'NOT_IMPLEMENTED', details);
  }
}

/**
 * 503 Service Unavailable - The server is currently unavailable (because it is overloaded or down for maintenance).
 */
export class ServiceUnavailableError extends MCPError {
  constructor(message: string = 'Service Unavailable', details?: any) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

/**
 * Error handler utility for converting errors to appropriate responses
 */
export const errorHandler = (error: Error) => {
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
