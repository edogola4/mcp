import { Router, RequestHandler } from 'express';
import { OAuthController } from '../controllers/OAuthController';
import { OAuthService } from '../services/auth/OAuthService';
import { Logger } from 'winston';
import { config } from '../config/config';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { AuthUser } from '../types/AuthUser';

export const createOAuthRoutes = async (logger: Logger) => {
  const router = Router();
  
  // Initialize OAuth service with logger
  const oauthService = new OAuthService(logger);
  
  // The OAuthService initializes itself in the constructor
  logger.info('OAuth service initialized');
  
  // Initialize OAuth controller
  const oauthController = new OAuthController(oauthService, logger);

  // Session configuration
  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.isProduction(),
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
    },
    genid: () => uuidv4(),
  };

  // Initialize session middleware
  router.use(session(sessionConfig));

  // OAuth routes with proper typing
  router.get('/login', oauthController.initiateLogin as RequestHandler);
  router.get('/callback', oauthController.handleCallback as RequestHandler);
  router.get('/logout', oauthController.logout as RequestHandler);
  router.get('/me', oauthController.getCurrentUser as RequestHandler);

  return router;
};

export default createOAuthRoutes;
