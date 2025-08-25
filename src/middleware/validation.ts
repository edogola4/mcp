import { validationResult, ValidationChain, body, query, param, ValidationError } from 'express-validator';

type FieldValidationError = {
  type: 'field';
  value: any;
  msg: string;
  path: string;
  location: 'body' | 'cookies' | 'headers' | 'params' | 'query';
};
import { Request, Response, NextFunction } from 'express';
import { MCPError } from '../utils/errors';
import { Logger } from 'winston';

/**
 * Format validation errors for consistent API responses
 */
const formatValidationError = (errors: ValidationError[]) => {
  return errors.map(error => {
    // Handle both FieldValidationError and AlternativeValidationError
    if ('path' in error) {
      const fieldError = error as FieldValidationError;
      return {
        param: fieldError.path,
        message: fieldError.msg,
        value: fieldError.value,
        location: fieldError.location,
      };
    } else {
      // For AlternativeValidationError, we don't have the same properties
      return {
        message: 'msg' in error ? error.msg : 'Validation failed',
        type: 'alternative',
        nestedErrors: 'nestedErrors' in error ? error.nestedErrors : undefined
      };
    }
  });
};

/**
 * Middleware to validate request data
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const formattedErrors = formatValidationError(errors.array());
    throw new MCPError(
      'Validation failed', 
      400, 
      'VALIDATION_ERROR', 
      { errors: formattedErrors }
    );
  };
};

/**
 * Common validation rules
 */
export const commonValidators = {
  id: (name = 'id') => 
    param(name)
      .trim()
      .isMongoId()
      .withMessage('Invalid ID format'),

  email: (field = 'email') => 
    body(field)
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),

  password: (field = 'password', minLength = 8) => 
    body(field)
      .isLength({ min: minLength })
      .withMessage(`Password must be at least ${minLength} characters long`)
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter'),

  string: (field: string, required = true) => {
    const validator = body(field).trim().isString().withMessage('Must be a string');
    return required 
      ? validator.notEmpty().withMessage('This field is required')
      : validator.optional();
  },

  number: (field: string, required = true) => {
    const validator = body(field).isNumeric().withMessage('Must be a number');
    return required 
      ? validator.notEmpty().withMessage('This field is required')
      : validator.optional();
  },

  boolean: (field: string, required = true) => {
    const validator = body(field).isBoolean().withMessage('Must be a boolean');
    return required 
      ? validator.notEmpty().withMessage('This field is required')
      : validator.optional();
  },

  array: (field: string, required = true) => {
    const validator = body(field).isArray().withMessage('Must be an array');
    return required 
      ? validator.notEmpty().withMessage('This field is required')
      : validator.optional();
  },

  object: (field: string, required = true) => {
    const validator = body(field).isObject().withMessage('Must be an object');
    return required 
      ? validator.notEmpty().withMessage('This field is required')
      : validator.optional();
  },

  date: (field: string, required = true) => {
    const validator = body(field).isISO8601().withMessage('Must be a valid date (ISO 8601)');
    return required 
      ? validator.notEmpty().withMessage('This field is required')
      : validator.optional();
  },

  enum: (field: string, values: any[], required = true) => {
    const validator = body(field).isIn(values).withMessage(`Must be one of: ${values.join(', ')}`);
    return required 
      ? validator.notEmpty().withMessage('This field is required')
      : validator.optional();
  },
};

/**
 * Pagination validation
 */
export const paginationValidators = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  query('sort')
    .optional()
    .isString()
    .trim()
    .matches(/^[a-zA-Z0-9_]+:(asc|desc)$/)
    .withMessage('Invalid sort format. Use: field:(asc|desc)'),
];

/**
 * Search validation
 */
export const searchValidators = [
  query('q')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  
  query('fields')
    .optional()
    .isString()
    .withMessage('Fields must be a comma-separated string')
    .customSanitizer((value: string) => value.split(',').map(f => f.trim())),
];

/**
 * File upload validation
 */
export const fileUploadValidators = (field: string, maxSizeMB = 10, allowedMimeTypes: string[] = []) => {
  return [
    body(field)
      .custom((_value, { req }) => {
        if (!req.file) {
          throw new Error('File is required');
        }
        return true;
      }),
    
    body(field)
      .custom((_value, { req }) => {
        if (req.file && req.file.size > maxSizeMB * 1024 * 1024) {
          throw new Error(`File size must be less than ${maxSizeMB}MB`);
        }
        return true;
      }),
    
    ...(allowedMimeTypes.length > 0 ? [
      body(field)
        .custom((_value, { req }) => {
          if (req.file && !allowedMimeTypes.includes(req.file.mimetype)) {
            throw new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
          }
          return true;
        })
    ] : [])
  ];
};

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof MCPError && err.code === 'VALIDATION_ERROR') {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }
  next(err);
};
