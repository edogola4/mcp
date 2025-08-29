import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import { MFAController } from '../controllers/MFAController';
import { Container } from 'typedi';
import { UserService } from '../services/UserService';
import { MFAService } from '../services/MFAService';
import createAuthMiddleware from '../middleware/auth.middleware';
import { Logger } from 'winston';
import { body, validationResult } from 'express-validator';
import { OAuthService } from '../services/OAuthService';

const router = Router();

// Initialize services with dependency injection
const logger = Container.get<Logger>('logger');
const userService = Container.get(UserService);
const mfaService = Container.get(MFAService);
const mfaController = new MFAController(mfaService, userService);

// Create auth middleware with optional OAuth service
let requireAuth: RequestHandler;
try {
    const oauthService = Container.get<OAuthService>('oauthService');
    const authMiddleware = createAuthMiddleware(oauthService, logger);
    requireAuth = authMiddleware.requireAuth();
} catch (error) {
    logger.warn('OAuth service not available. Some authentication features may be limited.');
    // Fallback to a simple authentication check if OAuth is not available
    requireAuth = (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }
        next();
    };
}

// Input validation middleware
const validateMfaSetup = [
    body('token')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 6, max: 6 })
        .withMessage('Token must be 6 digits')
        .matches(/^\d+$/)
        .withMessage('Token must contain only digits')
];

const validateMfaVerify = [
    body('token')
        .isString()
        .trim()
        .isLength({ min: 6, max: 6 })
        .withMessage('Token must be 6 digits')
        .matches(/^\d+$/)
        .withMessage('Token must contain only digits'),
    body('userId')
        .optional()
        .isString()
        .withMessage('User ID must be a string')
];

const validateMfaLogin = [
    body('userId')
        .isString()
        .notEmpty()
        .withMessage('User ID is required'),
    body('token')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 6, max: 6 })
        .withMessage('Token must be 6 digits')
        .matches(/^\d+$/)
        .withMessage('Token must contain only digits'),
    body('backupCode')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 8 })
        .withMessage('Backup code must be at least 8 characters')
];

// Error handling middleware
const handleValidation = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => {
                if ('nestedErrors' in err) {
                    return {
                        param: 'nested',
                        message: 'Validation failed for one or more fields',
                        nested: err.nestedErrors
                    };
                }
                return {
                    param: 'param' in err ? err.param : 'unknown',
                    message: err.msg,
                    location: 'location' in err ? err.location : 'body'
                };
            })
        });
    }
    next();
};

// Protected routes (require authentication)
router.post(
    '/setup', 
    requireAuth, 
    validateMfaSetup, 
    handleValidation,
    (req: Request, res: Response, next: NextFunction) => {
        mfaController.setupMFA(req, res).catch(next);
    }
);

router.post(
    '/verify', 
    requireAuth, 
    validateMfaVerify,
    handleValidation,
    (req: Request, res: Response, next: NextFunction) => {
        mfaController.verifyMFA(req, res).catch(next);
    }
);

// Public route for login verification
router.post(
    '/verify-login', 
    validateMfaLogin, 
    handleValidation,
    (req: Request, res: Response, next: NextFunction) => {
        mfaController.verifyLoginMFA(req, res).catch(next);
    }
);

// Add rate limiting in production
if (process.env.NODE_ENV === 'production') {
    const rateLimit = require('express-rate-limit');
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // limit each IP to 10 requests per windowMs
        message: {
            success: false,
            error: 'Too many requests, please try again later.'
        }
    });
    
    // Apply rate limiting to MFA verification endpoints
    router.use('/verify', limiter);
    router.use('/verify-login', limiter);
}

export default router;
