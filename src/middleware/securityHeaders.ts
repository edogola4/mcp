import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Default CORS configuration
const DEFAULT_CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const DEFAULT_CORS_METHODS = process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE';
const DEFAULT_CORS_HEADERS = process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization';

/**
 * Security middleware that sets various HTTP headers to help protect the app
 */
export const securityHeaders = [
  // Basic security headers
  helmet(),
  
  // Content Security Policy
  (req: Request, res: Response, next: NextFunction) => {
    // Only set CSP in production
    if (process.env.NODE_ENV === 'production') {
      const cspDirectives = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      };
      
      helmet.contentSecurityPolicy({
        directives: cspDirectives,
      })(req, res, next);
    } else {
      next();
    }
  },
  
  // Prevent clickjacking
  (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  },
  
  // Enable CORS with configuration
  (req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', DEFAULT_CORS_ORIGIN);
    res.header('Access-Control-Allow-Methods', DEFAULT_CORS_METHODS);
    res.header('Access-Control-Allow-Headers', DEFAULT_CORS_HEADERS);
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  }
];
