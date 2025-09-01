import { Container } from 'typedi';
import { OAuthService } from './services/OAuthService';
import { UserService } from './services/UserService';
import { MFAService } from './services/MFAService';
import config from './config';
import logger from './utils/logger';

export const setupContainer = async () => {
  try {
    // Register logger
    Container.set('logger', logger);

    // Register services
    Container.set('config', config);
    Container.set('userService', new UserService());
    Container.set('mfaService', new MFAService());

    // Register OAuthService if OAuth is configured
    const oauthEnabled = process.env.OAUTH_ENABLED === 'true';
    if (oauthEnabled) {
      const issuerUrl = process.env.OAUTH_ISSUER_URL;
      const clientId = process.env.OAUTH_CLIENT_ID;
      const clientSecret = process.env.OAUTH_CLIENT_SECRET;
      const redirectUri = process.env.OAUTH_REDIRECT_URI;
      const scope = process.env.OAUTH_SCOPE || 'openid profile email';
      
      if (!issuerUrl || !clientId || !clientSecret || !redirectUri) {
        logger.warn('OAuth is not fully configured. Some features may be limited.');
        return; // Skip OAuth initialization if not fully configured
      }
      
      const oauthService = new OAuthService({
        issuerUrl,
        clientId,
        clientSecret,
        redirectUri,
        scope,
      }, logger);
      
      // Initialize OAuthService
      await oauthService.initialize();
      
      // Register the service in the container
      Container.set('oauthService', oauthService);
    } else {
      logger.warn('OAuth is not configured. Some features may be limited.');
    }

    // Register other services
    const userService = new UserService();
    Container.set(UserService, userService);
    
    const mfaService = new MFAService();
    Container.set(MFAService, mfaService);

    logger.info('Container services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize container services', { error });
    throw error;
  }
};

// Export container for direct use if needed
export { Container } from 'typedi';
