import { Logger } from 'winston';
import { AuthUser } from '../../types/AuthUser';
import config from '../../config';

// Use require for openid-client to avoid TypeScript issues
const { Issuer, Client } = require('openid-client');

interface OAuthClient {
  authorizationUrl: (params: any) => string;
  callback: (redirectUri: string, params: any, options: any) => Promise<any>;
  userinfo: (tokenSet: any) => Promise<any>;
  refresh: (refreshToken: string) => Promise<any>;
  revoke: (token: string, tokenTypeHint?: string) => Promise<void>;
}

export class OAuthService {
  private client: OAuthClient | null = null;
  private logger: Logger;
  private isInitialized: boolean = false;
  private readonly config = config.oauth;
  
  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeClient().catch(error => {
      this.logger.error('Failed to initialize OAuth client:', error);
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    if (!this.client) {
      await this.initializeClient();
    }
    
    this.isInitialized = true;
  }

  private async initializeClient(): Promise<void> {
    try {
      if (!this.config.issuerUrl) {
        throw new Error('OAuth issuer URL is not configured');
      }

      this.logger.info('Discovering OAuth issuer...');
      const issuer = await Issuer.discover(this.config.issuerUrl);
      
      this.client = new issuer.Client({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uris: this.config.redirectUris,
        post_logout_redirect_uris: this.config.postLogoutRedirectUris,
        response_types: ['code'],
      });
      
      this.logger.info('OAuth client initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize OAuth client: ${errorMessage}`);
      throw new Error(`OAuth client initialization failed: ${errorMessage}`);
    }
  }

  public async getAuthorizationUrl(state: string, nonce: string): Promise<string> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('OAuth client not available');
    }

    try {
      const url = this.client.authorizationUrl({
        scope: this.config.scope,
        state,
        nonce,
        response_mode: 'query',
      });
      
      this.logger.debug('Generated authorization URL');
      return url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate authorization URL: ${errorMessage}`);
      throw new Error(`Failed to generate authorization URL: ${errorMessage}`);
    }
  }

  public async validateCallback(params: URLSearchParams, state: string, nonce: string): Promise<{
    tokenSet: any;
    userInfo: any;
    user: AuthUser;
  }> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('OAuth client not available');
    }

    try {
      this.logger.debug('Validating OAuth callback...');
      const tokenSet = await this.client.callback(
        this.config.redirectUris[0],
        Object.fromEntries(params.entries()),
        { state, nonce }
      );
      
      this.logger.debug('Fetching user info...');
      const userInfo = await this.client.userinfo(tokenSet);

      // Map user info to your application's user model
      const user: AuthUser = {
        id: userInfo.sub || '',
        email: userInfo.email || '',
        roles: ['user'], // Default role
        name: userInfo.name || userInfo.preferred_username || '',
        ...userInfo // Include any additional user info
      };

      this.logger.info(`User authenticated: ${user.email}`);
      return { tokenSet, userInfo, user };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`OAuth validation failed: ${errorMessage}`);
      throw new Error(`Authentication failed: ${errorMessage}`);
    }
  }

  public async refreshToken(refreshToken: string): Promise<any> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('OAuth client not available');
    }
    
    try {
      this.logger.debug('Refreshing access token...');
      const tokenSet = await this.client.refresh(refreshToken);
      this.logger.debug('Access token refreshed successfully');
      return tokenSet;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Token refresh failed: ${errorMessage}`);
      throw new Error(`Token refresh failed: ${errorMessage}`);
    }
  }

  public async revokeToken(token: string, tokenTypeHint: 'access_token' | 'refresh_token' = 'access_token'): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('OAuth client not available');
    }
    
    try {
      this.logger.debug(`Revoking ${tokenTypeHint}...`);
      await this.client.revoke(token, tokenTypeHint);
      this.logger.debug('Token revoked successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Token revocation failed: ${errorMessage}`);
      throw new Error(`Token revocation failed: ${errorMessage}`);
    }
  }
  
  public async getUserInfo(accessToken: string): Promise<any> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('OAuth client not available');
    }
    
    try {
      this.logger.debug('Fetching user info...');
      const userInfo = await this.client.userinfo(accessToken);
      return userInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch user info: ${errorMessage}`);
      throw new Error(`Failed to fetch user info: ${errorMessage}`);
    }
  }
}
