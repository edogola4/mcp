import { Request, Response, NextFunction, RequestHandler } from 'express';
import { OAuthService } from '../services/OAuthService';
import { MFAService } from '../services/MFAService';
import { UserService } from '../services/UserService';
import { Logger } from 'winston';
import { MCPError } from '../utils/errors';
import { Container } from 'typedi';
import { AuthUser } from '../controllers/MFAController';

export { AuthUser };

// Extend Express Request type
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    mfaVerified?: boolean;
    hasRole(role: string): boolean;
    hasAnyRole(roles: string[]): boolean;
  }
}

export class AuthMiddleware {
  private oauthService: OAuthService;
  private mfaService: MFAService;
  private userService: UserService;
  private logger: Logger;
  private roleHierarchy: Record<string, string[]>;

  constructor(
    oauthService: OAuthService,
    mfaService: MFAService,
    userService: UserService,
    logger: Logger
  ) {
    this.oauthService = oauthService;
    this.mfaService = mfaService;
    this.userService = userService;
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
  requireAuth(requireMFA = true): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new MCPError('Authentication required', 401, 'UNAUTHENTICATED');
        }

        // If MFA is required and enabled for the user
        if (requireMFA && req.user.mfaEnabled && !req.mfaVerified) {
          // Check for MFA token in header
          const mfaToken = req.headers['x-mfa-token'] as string;
          
          if (!mfaToken) {
            throw new MCPError(
              'MFA token required',
              403,
              'MFA_REQUIRED',
              { requiresMFA: true, userId: req.user.id }
            );
          }

          // Get user from database to verify MFA
          const user = await this.userService.getUserById(req.user.id);
          if (!user || !user.mfaEnabled || !user.mfaSecret) {
            throw new MCPError('MFA not properly configured', 403, 'MFA_NOT_CONFIGURED');
          }

          // Verify the MFA token
          const isValid = this.mfaService.verifyToken(user.mfaSecret, mfaToken);
          if (!isValid) {
            throw new MCPError('Invalid MFA token', 403, 'INVALID_MFA_TOKEN');
          }

          // Mark MFA as verified for this request
          req.mfaVerified = true;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware to check if MFA is required but not verified
   */
  checkMFA(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.user?.mfaEnabled && !req.mfaVerified) {
        throw new MCPError(
          'MFA verification required',
          403,
          'MFA_VERIFICATION_REQUIRED',
          { requiresMFA: true, userId: req.user.id }
        );
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
export const createAuthMiddleware = (
  oauthService: OAuthService,
  logger: Logger,
  mfaService?: MFAService,
  userService?: UserService
) => {
  // If services aren't provided, try to get them from the container
  const mfa = mfaService || Container.get(MFAService);
  const userSvc = userService || Container.get(UserService);
  
  const authMiddleware = new AuthMiddleware(oauthService, mfa, userSvc, logger);
  return authMiddleware;
};

export default createAuthMiddleware;
