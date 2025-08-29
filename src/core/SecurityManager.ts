import winston, { Logger } from 'winston';
import { OAuthService } from '../services/OAuthService';
import { createAuthMiddleware, AuthMiddleware } from '../middleware/auth.middleware';
import { createSecurityMiddleware } from '../middleware/security.middleware';
import { createAuthRoutes } from '../routes/auth.routes';
import securityConfig from '../config/security';
import { Router } from 'express';

export class SecurityManager {
  private oauthService: OAuthService | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = winston.createLogger({
      ...logger,
      defaultMeta: { ...logger.defaultMeta, service: 'SecurityManager' }
    });
  }

  async initialize() {
    // Define the return type explicitly to match the AuthMiddleware interface
    type AuthResult = {
      middleware: AuthMiddleware;
      service: OAuthService;
      routes: Router;
    };

    type SecurityResult = {
      cors: any;
      rateLimit: any;
      securityHeaders: any;
    };

    type InitializeResult = {
      auth: AuthResult | null;
      security: SecurityResult;
    };
    // Initialize security middleware first (always needed)
    const securityMiddleware = createSecurityMiddleware(
      {
        allowedOrigins: securityConfig.cors.allowedOrigins,
        rateLimit: {
          windowMs: securityConfig.rateLimit.windowMs,
          max: securityConfig.rateLimit.max,
          message: securityConfig.rateLimit.message,
        },
      },
      this.logger
    );

    // Initialize OAuth service if enabled
    if (securityConfig.oauth.enabled) {
      this.oauthService = new OAuthService(
        {
          issuerUrl: securityConfig.oauth.issuerUrl,
          clientId: securityConfig.oauth.clientId,
          clientSecret: securityConfig.oauth.clientSecret,
          redirectUri: securityConfig.oauth.redirectUri,
          scope: securityConfig.oauth.scope,
        },
        this.logger
      );
      
      try {
        await this.oauthService.initialize();
        this.logger.info('OAuth service initialized successfully');
        
        // Initialize auth middleware with OAuth service
        const authMiddleware = createAuthMiddleware(this.oauthService, this.logger);
        const authRoutes = createAuthRoutes(this.oauthService, authMiddleware, this.logger);
        
        return {
          auth: {
            middleware: authMiddleware,
            service: this.oauthService,
            routes: authRoutes
          },
          security: securityMiddleware
        };
      } catch (error) {
        this.logger.error('Failed to initialize OAuth service', { error });
        // Fall through to return security middleware only
      }
    }

    // Return security middleware only (no OAuth)
    return {
      auth: {
        middleware: null,
        service: null,
        routes: null
      },
      security: securityMiddleware
    };
  }
}

export default SecurityManager;
