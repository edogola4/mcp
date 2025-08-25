import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn('.env file not found. Using default environment variables.');
}

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

export interface SecurityConfig {
  cors: {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface FileSystemConfig {
  sandboxDir: string;
  maxFileSizeMB: number;
}

export interface Config {
  server: ServerConfig;
  logger: LoggerConfig;
  database: DatabaseConfig;
  weather: WeatherConfig;
  security: SecurityConfig;
  fileSystem: FileSystemConfig;
}

// Default configuration
const defaultConfig: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    environment: process.env.NODE_ENV || 'development',
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '1mb',
    shutdownTimeout: 30000, // 30 seconds
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
  security: {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
  },
  fileSystem: {
    sandboxDir: process.env.SANDBOX_DIR || './sandbox',
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  },
};

// Validate required configuration
const validateConfig = (config: Config): void => {
  const requiredVars = [
    { key: 'OPENWEATHER_API_KEY', value: config.weather.apiKey, message: 'OpenWeather API key is required' },
  ];

  const missingVars = requiredVars.filter(({ value }) => !value);
  if (missingVars.length > 0) {
    const errorMessages = missingVars.map(({ key, message }) => `${key}: ${message}`).join('\n');
    throw new Error(`Missing required environment variables:\n${errorMessages}`);
  }
};

// Create and validate the configuration
export const config: Config = {
  ...defaultConfig,
  // Override with environment-specific settings if needed
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
