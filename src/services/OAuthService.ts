import { Issuer, Client, TokenSet } from 'openid-client';
import { Logger } from 'winston';

export interface OAuthConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

export class OAuthService {
  private config: OAuthConfig;
  private client: Client | null = null;
  private logger: Logger;

  constructor(config: OAuthConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ service: 'OAuthService' });
  }

  async initialize() {
    try {
      const issuer = await Issuer.discover(this.config.issuerUrl);
      this.client = new issuer.Client({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uris: [this.config.redirectUri],
        response_types: ['code'],
      });
      this.logger.info('OAuth client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OAuth client', { error });
      throw error;
    }
  }

  getAuthorizationUrl(state: string, nonce: string): string {
    if (!this.client) {
      throw new Error('OAuth client not initialized');
    }
    return this.client.authorizationUrl({
      scope: this.config.scope,
      state,
      nonce,
    });
  }

  async getTokens(code: string): Promise<TokenSet> {
    if (!this.client) {
      throw new Error('OAuth client not initialized');
    }
    return this.client.callback(this.config.redirectUri, { code });
  }

  async getUserInfo(tokenSet: TokenSet) {
    if (!this.client) {
      throw new Error('OAuth client not initialized');
    }
    return this.client.userinfo(tokenSet);
  }
}
