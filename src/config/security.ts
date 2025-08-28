interface SecurityConfig {
  oauth: {
    enabled: boolean;
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string;
  };
  cors: {
    allowedOrigins: string[];
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    max: number;
    message: string;
  };
  session: {
    secret: string;
    cookie: {
      secure: boolean;
      httpOnly: boolean;
      maxAge: number;
      sameSite: 'lax' | 'strict' | 'none';
    };
  };
}

const securityConfig: SecurityConfig = {
  oauth: {
    enabled: process.env.OAUTH_ENABLED === 'true',
    issuerUrl: process.env.OAUTH_ISSUER_URL || 'https://accounts.google.com',
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    scope: process.env.OAUTH_SCOPE || 'openid email profile',
  },
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5173'],
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
  },
  session: {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
    },
  },
};

export default securityConfig;
