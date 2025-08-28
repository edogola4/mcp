import { Router } from 'express';
import { OAuthService } from '../services/OAuthService';
import { Logger } from 'winston';
import { MCPError } from '../utils/errors';
import { AuthMiddleware } from '../middleware/auth.middleware';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import securityConfig from '../config/security';

export const createAuthRoutes = (
  oauthService: OAuthService,
  authMiddleware: ReturnType<typeof AuthMiddleware>,
  logger: Logger
) => {
  const router = Router();

  // Session configuration
  const sessionConfig = {
    secret: securityConfig.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      ...securityConfig.session.cookie,
      maxAge: securityConfig.session.cookie.maxAge,
    },
    genid: () => uuidv4(),
  };

  // Initialize session middleware
  router.use(session(sessionConfig));

  // Initialize auth middleware
  router.use(authMiddleware.initialize);

  // Login route - redirects to OAuth provider
  router.get('/login', (req, res) => {
    try {
      const state = uuidv4();
      const nonce = uuidv4();
      
      // Store state and nonce in session
      req.session.state = state;
      req.session.nonce = nonce;

      const authUrl = oauthService.getAuthorizationUrl(state, nonce);
      res.redirect(authUrl);
    } catch (error) {
      logger.error('Login error', { error });
      throw new MCPError('Authentication failed', 500, 'AUTH_ERROR');
    }
  });

  // OAuth callback route
  router.get('/callback', authMiddleware.handleOAuthCallback, (req, res) => {
    // Redirect to the frontend after successful authentication
    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(redirectUrl);
  });

  // Logout route
  router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Logout error', { error: err });
        throw new MCPError('Logout failed', 500, 'AUTH_ERROR');
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Successfully logged out' });
    });
  });

  // Get current user
  router.get('/me', authMiddleware.requireAuth(), (req, res) => {
    if (!req.user) {
      throw new MCPError('Not authenticated', 401, 'UNAUTHENTICATED');
    }
    // Return minimal user info (don't expose sensitive data)
    const { id, email, roles } = req.user;
    res.json({ id, email, roles });
  });

  return router;
};

export default createAuthRoutes;
