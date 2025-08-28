import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import cors, { CorsOptions } from 'cors';
import { Logger } from 'winston';

interface SecurityConfig {
  // CORS configuration
  allowedOrigins: string[];
  // Rate limiting configuration
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
  };
}

export class SecurityMiddleware {
  private config: SecurityConfig;
  private logger: Logger;

  constructor(config: SecurityConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ service: 'SecurityMiddleware' });
  }

  /**
   * Configure CORS with strict origin policy
   */
  configureCors() {
    const corsOptions: CorsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) {
          this.logger.warn('Request with no origin', { origin });
          return callback(null, false);
        }

        // Check if the origin is in the allowed list
        if (this.config.allowedOrigins.includes(origin) || this.config.allowedOrigins.includes('*')) {
          return callback(null, true);
        }

        this.logger.warn('CORS blocked request from origin', { origin });
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 600, // 10 minutes
    };

    return cors(corsOptions);
  }

  /**
   * Configure rate limiting
   */
  configureRateLimit() {
    return rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: this.config.rateLimit.message,
      standardHeaders: true,
      legacyHeaders: false,
      // Skip rate limiting for authenticated admin users
      skip: (req) => {
        return req.user?.roles?.includes('admin') === true;
      },
      // Custom handler for rate limit exceeded
      handler: (req, res) => {
        this.logger.warn('Rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          user: req.user?.id || 'anonymous',
        });
        
        res.status(429).json({
          error: 'Too many requests',
          message: this.config.rateLimit.message,
        });
      },
    });
  }

  /**
   * Security headers middleware
   */
  securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      
      // Remove X-Powered-By header
      res.removeHeader('X-Powered-By');
      
      next();
    };
  }
}

// Helper function to create and initialize the security middleware
export const createSecurityMiddleware = (config: SecurityConfig, logger: Logger) => {
  const security = new SecurityMiddleware(config, logger);
  return {
    cors: security.configureCors(),
    rateLimit: security.configureRateLimit(),
    securityHeaders: security.securityHeaders(),
  };
};

export default createSecurityMiddleware;
