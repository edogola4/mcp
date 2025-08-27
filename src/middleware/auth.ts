import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { MCPError } from '../utils/errors';
import { Logger } from 'winston';

interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  apiKeys?: string[];
}

export interface AuthUser {
  id: string;
  email?: string;
  roles?: string[];
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export class AuthService {
  private config: AuthConfig;
  private logger: Logger;

  constructor(config: AuthConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Generate JWT token for a user
   */
  public generateToken(user: AuthUser): string {
    const payload = { 
      sub: user.id,
      email: user.email,
      roles: user.roles || []
    };
    
    const options: jwt.SignOptions = {};
    
    // Only add expiresIn if jwtExpiresIn is defined
    if (this.config.jwtExpiresIn) {
      options.expiresIn = this.config.jwtExpiresIn;
    }
    
    return jwt.sign(
      payload,
      this.config.jwtSecret,
      options
    );
  }

  /**
   * Verify JWT token
   */
  public verifyToken(token: string): AuthUser | null {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as jwt.JwtPayload;
      return {
        id: decoded.sub as string,
        email: decoded.email,
        roles: decoded.roles || [],
        ...decoded
      };
    } catch (error) {
      this.logger.warn('Invalid token', { error });
      return null;
    }
  }

  /**
   * Authenticate using API key
   */
  public authenticateApiKey(apiKey: string): boolean {
    if (!this.config.apiKeys || this.config.apiKeys.length === 0) {
      this.logger.warn('API key authentication is not configured');
      return false;
    }
    return this.config.apiKeys.includes(apiKey);
  }

  /**
   * Middleware to require authentication
   */
  public requireAuth() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check for API key in headers
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey && this.authenticateApiKey(apiKey)) {
        return next();
      }

      // Check for JWT in Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer <token>
        if (token) {
          const user = this.verifyToken(token);
          if (user) {
            req.user = user;
            return next();
          }
        }
      }

      // Authentication failed
      this.logger.warn('Authentication failed', { 
        path: req.path,
        method: req.method,
        ip: req.ip 
      });
      
      throw new MCPError('Authentication required', 401, 'UNAUTHORIZED');
    };
  }

  /**
   * Middleware to require specific roles
   */
  public requireRole(roles: string | string[]) {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new MCPError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const userRoles = req.user.roles || [];
      const hasRole = requiredRoles.some(role => userRoles.includes(role));
      
      if (!hasRole) {
        this.logger.warn('Insufficient permissions', { 
          userId: req.user.id,
          requiredRoles,
          userRoles
        });
        throw new MCPError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      next();
    };
  }

  /**
   * Middleware to require API key
   */
  public requireApiKey() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey || !this.authenticateApiKey(apiKey)) {
        this.logger.warn('Invalid or missing API key', { 
          path: req.path,
          method: req.method,
          ip: req.ip 
        });
        throw new MCPError('Invalid or missing API key', 401, 'INVALID_API_KEY');
      }
      
      next();
    };
  }
}

/**
 * Create authentication middleware with default configuration
 */
export const createAuthMiddleware = (config: AuthConfig, logger: Logger) => {
  const authService = new AuthService(config, logger);
  
  return {
    requireAuth: authService.requireAuth.bind(authService),
    requireRole: authService.requireRole.bind(authService),
    requireApiKey: authService.requireApiKey.bind(authService),
    generateToken: authService.generateToken.bind(authService),
    verifyToken: authService.verifyToken.bind(authService)
  };
};

export default createAuthMiddleware;
