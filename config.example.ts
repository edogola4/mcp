/**
 * Configuration Template
 * 
 * Copy this file to `.env` in the project root and fill in the values.
 * Make sure to never commit the `.env` file to version control.
 * 
 * All configuration values are validated against the schema in `src/config/config.ts`.
 * Required fields must be provided, others have default values.
 */

export const config = {
  // Server Configuration
  NODE_ENV: 'development', // 'development' | 'production' | 'test'
  PORT: 3000,
  HOST: '0.0.0.0',
  
  // Security
  JWT_SECRET: 'your-secure-jwt-secret-min-32-chars-long',
  JWT_EXPIRES_IN: '1d',
  
  // Database
  DB_PATH: './data/mcp-db.sqlite',
  DB_LOGGING: false,
  
  // File System
  BASE_STORAGE_PATH: './storage',
  MAX_FILE_SIZE_MB: 10,
  
  // Logging
  LOG_LEVEL: 'info', // 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly'
  LOG_TO_FILE: false,
  LOG_FILE_PATH: 'logs/app.log',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
  RATE_LIMIT_MAX: 100,
  
  // CORS
  CORS_ORIGIN: '*',
  CORS_METHODS: 'GET,POST,PUT,DELETE,OPTIONS',
  CORS_ALLOWED_HEADERS: 'Content-Type,Authorization',
  
  // API Documentation
  API_DOCS_ENABLED: true,
  API_DOCS_PATH: '/api-docs',
  
  // External Services
  WEATHER_API_KEY: 'your-weather-api-key', // Optional
  WEATHER_API_URL: 'https://api.weatherapi.com/v1',
  
  // Feature Flags
  FEATURE_FILE_UPLOAD: true,
  
  // OAuth (Optional)
  OAUTH_ENABLED: false,
  OAUTH_ISSUER_URL: 'https://your-oauth-provider.com',
  OAUTH_CLIENT_ID: 'your-client-id',
  OAUTH_CLIENT_SECRET: 'your-client-secret',
  OAUTH_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  OAUTH_SCOPE: 'openid profile email',
  
  // Sentry (Optional)
  SENTRY_DSN: 'your-sentry-dsn',
  
  // Other environment-specific settings
  // ...
} as const;

/**
 * To use this configuration:
 * 1. Copy this file to `.env` in the project root
 * 2. Update the values as needed
 * 3. The application will automatically load these values at startup
 * 
 * For production, consider using environment variables directly
 * instead of a .env file for better security
 */
