import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading environment from:', envPath);
if (existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('Successfully loaded .env file');
  }
} else {
  console.warn('.env file not found. Using default environment variables.');
}

// Debug: Log important environment variables
console.log('OPENWEATHER_API_KEY exists:', !!process.env.OPENWEATHER_API_KEY);

// Parse environment variables with defaults
export interface ServerConfig {
  port: number;
  environment: string;
  maxRequestSize: string;
  shutdownTimeout: number;
}

export interface LoggerConfig {
  level: string;
  file: string;
  console: boolean;
}

export interface DatabaseConfig {
  path: string;
  logging: boolean;
}

export interface WeatherConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

// Import the security configuration
import securityConfig, { SecurityConfig } from './security';

// Re-export the security configuration
export { securityConfig };

/**
 * @deprecated Use SecurityConfig from './security' instead
 */
export interface LegacySecurityConfig {
  cors: {
    enabled: boolean;
    allowedOrigins: string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    max: number;
    message: string;
    trustProxy: boolean;
  };
  // Add other security-related configurations as needed
}

export interface FileSystemConfig {
  sandboxDir: string;
  maxFileSizeMB: number;
}

// Main configuration interface
export interface OAuthConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  issuerUrl: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  scope: string;
}

export interface Config {
  server: ServerConfig;
  logger: LoggerConfig;
  database: DatabaseConfig;
  weather: WeatherConfig;
  security: SecurityConfig;
  fileSystem: FileSystemConfig;
  oauth: OAuthConfig;
}

// Default configuration
const defaultConfig: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    environment: process.env.NODE_ENV || 'development',
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '1mb',
    shutdownTimeout: 30000, // 30 seconds
  },
  oauth: {
    enabled: process.env.OAUTH_ENABLED === 'true',
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    issuerUrl: process.env.OAUTH_ISSUER_URL || 'http://localhost:9000',
    redirectUris: process.env.OAUTH_REDIRECT_URIS 
      ? process.env.OAUTH_REDIRECT_URIS.split(',') 
      : ['http://localhost:3000/auth/callback'],
    postLogoutRedirectUris: process.env.OAUTH_POST_LOGOUT_REDIRECT_URIS
      ? process.env.OAUTH_POST_LOGOUT_REDIRECT_URIS.split(',')
      : ['http://localhost:3000'],
    scope: process.env.OAUTH_SCOPE || 'openid profile email'
  },
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/mcp-server.log',
    console: process.env.LOG_CONSOLE !== 'false',
  },
  database: {
    path: process.env.DB_PATH || './data/mcp-db.sqlite',
    logging: process.env.DB_LOGGING === 'true',
  },
  weather: {
    apiKey: process.env.OPENWEATHER_API_KEY || '',
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    timeout: 5000, // 5 seconds
  },
  security: securityConfig,
  fileSystem: {
    sandboxDir: process.env.FS_SANDBOX_DIR || 'sandbox',
    maxFileSizeMB: parseInt(process.env.FS_MAX_FILE_SIZE_MB || '10', 10),
  },
};

// Validate required configuration
const validateConfig = (config: Config): void => {
  interface RequiredVar {
    key: string;
    value: any;
    message: string;
  }

  const requiredVars: RequiredVar[] = [
    // Add any truly required environment variables here
    // Example:
    // { key: 'JWT_SECRET', value: config.security.jwtSecret, message: 'JWT secret is required' },
  ];

  const missingVars = requiredVars.filter(({ value }) => !value);
  if (missingVars.length > 0) {
    const errorMessages = missingVars.map(({ key, message }) => `${key}: ${message}`).join('\n');
    throw new Error(`Missing required environment variables:\n${errorMessages}`);
  }

  // Log a warning if weather API key is missing, but don't fail
  if (!config.weather.apiKey) {
    console.warn('Warning: OpenWeather API key is not set. Weather-related features will be disabled.');
  }
};

// Create and validate the configuration
const config: Config = {
  ...defaultConfig,
  // Override with environment-specific settings if needed
  // Use the security config directly since it's already validated
  security: securityConfig,
  ...(process.env.NODE_ENV === 'production' && {
    server: {
      ...defaultConfig.server,
      environment: 'production',
    },
    logger: {
      ...defaultConfig.logger,
      level: 'info',
    },
  }),
  ...(process.env.NODE_ENV === 'test' && {
    server: {
      ...defaultConfig.server,
      port: 0, // Let the OS assign a random port for tests
    },
    database: {
      ...defaultConfig.database,
      path: ':memory:', // Use in-memory database for tests
    },
  }),
};

// Validate the configuration
if (process.env.NODE_ENV !== 'test') {
  validateConfig(config);
}

export default config;
