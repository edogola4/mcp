import { Request, Response, NextFunction, RequestHandler, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { OAuthService } from '../services/auth/OAuthService';
import { Logger } from 'winston';
import { AuthUser } from '../types/AuthUser';
import session from 'express-session';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser & { email?: string; roles?: string[] };
    session: session.Session & Partial<session.SessionData> & {
      state?: string;
      nonce?: string;
      user?: AuthUser & { email?: string; roles?: string[] };
      tokenSet?: any;
      returnTo?: string;
    };
  }
}

type CustomRequest = Request;

// Type for our controller methods
type ControllerMethod = (req: CustomRequest, res: Response, next?: NextFunction) => Promise<Response | void> | Response | void;

export class OAuthController {
  private oauthService: OAuthService;
  private logger: Logger;
  private sessionSecret: string;

  constructor(oauthService: OAuthService, logger: Logger) {
    this.oauthService = oauthService;
    this.logger = logger;
    this.sessionSecret = process.env.SESSION_SECRET || 'your-session-secret';
  }

  public initiateLogin: ControllerMethod = async (req, res) => {
    try {
      const state = uuidv4();
      const nonce = uuidv4();

      // Store state and nonce in session
      req.session.state = state;
      req.session.nonce = nonce;
      
      // Save session and wait for it to complete
      await new Promise<void>((resolve, reject) => {
        req.session.save(err => {
          if (err) reject(err);
          else resolve();
        });
      });

      const authorizationUrl = await this.oauthService.getAuthorizationUrl(state, nonce);
      res.redirect(authorizationUrl);
    } catch (error) {
      this.logger.error('Login initiation failed:', error);
      res.status(500).json({ error: 'Failed to initiate login' });
    }
  };

  public handleCallback: ControllerMethod = async (req, res) => {
    try {
      const { state, code } = req.query;
      const sessionState = req.session.state;
      const nonce = req.session.nonce;

      // Validate state
      if (!state || state !== sessionState) {
        this.logger.warn('Invalid state parameter');
        return res.status(400).json({ error: 'Invalid state parameter' });
      }

      // Clear the state from the session
      delete req.session.state;
      delete req.session.nonce;

      const { tokenSet, user } = await this.oauthService.validateCallback(
        new URLSearchParams(req.query as Record<string, string>),
        state as string,
        nonce as string
      );

      // Set user in session
      req.session.user = user;
      req.session.tokenSet = tokenSet;
      
      // Save session and wait for it to complete
      await new Promise<void>((resolve, reject) => {
        req.session.save(err => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Redirect to the original URL or home
      const returnTo = req.session.returnTo || '/';
      delete req.session.returnTo;
      res.redirect(returnTo);
    } catch (error) {
      this.logger.error('OAuth callback failed:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  public logout: ControllerMethod = (req, res) => {
    req.session.destroy((err?: Error) => {
      if (err) {
        this.logger.error('Failed to destroy session:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  };

  public getCurrentUser: ControllerMethod = (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    // Return minimal user info
    const { id, email, roles } = req.user;
    res.json({ id, email, roles });
  };

  // Middleware to require authentication
  public requireAuth: RequestHandler = (req, res, next) => {
    if (!req.user) {
      // Store the original URL for redirect after login
      req.session.returnTo = req.originalUrl;
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  };

  // Middleware to require specific role
  public requireRole = (roles: string | string[]): RequestHandler => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req: CustomRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        req.session.returnTo = req.originalUrl;
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRoles = req.user.roles || [];
      const hasRequiredRole = requiredRoles.some(role => 
        userRoles.includes(role)
      );

      if (!hasRequiredRole) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  };
}
