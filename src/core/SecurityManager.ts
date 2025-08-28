import winston, { Logger } from 'winston';
import { OAuthService } from '../services/OAuthService';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { createSecurityMiddleware } from '../middleware/security.middleware';
import { createAuthRoutes } from '../routes/auth.routes';
import securityConfig from '../config/security';

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
      } catch (error) {
        this.logger.error('Failed to initialize OAuth service', { error });
        throw error;
      }
    }

    // Initialize security middleware
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

    // Initialize auth middleware
    const authMiddleware = createAuthMiddleware(this.oauthService!, this.logger);

    // Create auth routes if OAuth is enabled
    const authRoutes = this.oauthService 
      ? createAuthRoutes(this.oauthService, authMiddleware, this.logger)
      : null;

    return {
      auth: {
        middleware: authMiddleware,
        routes: authRoutes,
      },
      security: securityMiddleware,
    };
  }
}

export default SecurityManager;
