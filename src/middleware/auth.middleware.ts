import { Request, Response, NextFunction } from 'express';
import { OAuthService } from '../services/OAuthService';
import { Logger } from 'winston';
import { MCPError } from '../utils/errors';

export interface AuthUser {
  id: string;
  email?: string;
  roles: string[];
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      hasRole(role: string): boolean;
      hasAnyRole(roles: string[]): boolean;
    }
  }
}

export class AuthMiddleware {
  private oauthService: OAuthService;
  private logger: Logger;
  private roleHierarchy: Record<string, string[]>;

  constructor(oauthService: OAuthService, logger: Logger) {
    this.oauthService = oauthService;
    this.logger = logger.child({ service: 'AuthMiddleware' });
    
    // Define role hierarchy (higher roles include all lower roles)
    this.roleHierarchy = {
      admin: ['admin', 'editor', 'viewer'],
      editor: ['editor', 'viewer'],
      viewer: ['viewer']
    };
  }

  /**
   * Middleware to ensure user is authenticated
   */
  requireAuth() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new MCPError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      next();
    };
  }

  /**
   * Middleware to check if user has specific role
   */
  requireRole(requiredRole: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      this.requireAuth()(req, res, () => {
        if (!req.user || !this.hasRole(req.user, requiredRole)) {
          throw new MCPError('Insufficient permissions', 403, 'FORBIDDEN');
        }
        next();
      });
    };
  }

  /**
   * Middleware to check if user has any of the specified roles
   */
  requireAnyRole(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      this.requireAuth()(req, res, () => {
        if (!req.user || !roles.some(role => this.hasRole(req.user!, role))) {
          throw new MCPError('Insufficient permissions', 403, 'FORBIDDEN');
        }
        next();
      });
    };
  }

  /**
   * OAuth callback handler
   */
  async handleOAuthCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.query;
      
      if (!code || typeof code !== 'string') {
        throw new MCPError('Invalid authorization code', 400, 'INVALID_REQUEST');
      }

      // Exchange authorization code for tokens
      const tokenSet = await this.oauthService.getTokens(code);
      const userInfo = await this.oauthService.getUserInfo(tokenSet);

      // Map user info to our auth user
      const user: AuthUser = {
        id: userInfo.sub,
        email: userInfo.email,
        roles: this.mapRolesFromClaims(userInfo)
      };

      // Set user in session
      req.user = user;
      next();
    } catch (error) {
      this.logger.error('OAuth callback error', { error });
      next(error);
    }
  }

  /**
   * Initialize request with auth helpers
   */
  initializeRequest(req: Request, res: Response, next: NextFunction) {
    // Add helper methods to request object
    req.hasRole = (role: string) => {
      return req.user ? this.hasRole(req.user, role) : false;
    };

    req.hasAnyRole = (roles: string[]) => {
      return req.user ? roles.some(role => this.hasRole(req.user!, role)) : false;
    };

    next();
  }

  private hasRole(user: AuthUser, requiredRole: string): boolean {
    if (!user.roles) return false;
    
    // Check if user has the role or a higher role
    for (const role of user.roles) {
      const includedRoles = this.roleHierarchy[role] || [role];
      if (includedRoles.includes(requiredRole)) {
        return true;
      }
    }
    return false;
  }

  private mapRolesFromClaims(claims: any): string[] {
    // Default roles if none specified
    if (!claims.roles || !Array.isArray(claims.roles)) {
      return ['viewer'];
    }
    
    // Ensure all roles are lowercase for consistency
    return claims.roles.map((r: any) => r.toString().toLowerCase());
  }
}

// Helper function to create and initialize the auth middleware
export const createAuthMiddleware = (oauthService: OAuthService, logger: Logger) => {
  const auth = new AuthMiddleware(oauthService, logger);
  return {
    requireAuth: auth.requireAuth.bind(auth),
    requireRole: auth.requireRole.bind(auth),
    requireAnyRole: auth.requireAnyRole.bind(auth),
    handleOAuthCallback: auth.handleOAuthCallback.bind(auth),
    initialize: auth.initializeRequest.bind(auth)
  };
};

export default createAuthMiddleware;
