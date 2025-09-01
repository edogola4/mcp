import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// Define the configuration schema using Zod
const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  
  // Security
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  
  // Database
  DB_PATH: z.string().default('./data/mcp-db.sqlite'),
  DB_LOGGING: z.coerce.boolean().default(false),
  
  // File System
  BASE_STORAGE_PATH: z.string().default('./storage'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_TO_FILE: z.coerce.boolean().default(false),
  LOG_FILE_PATH: z.string().default('logs/app.log'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  CORS_METHODS: z.string().default('GET,POST,PUT,DELETE,OPTIONS'),
  CORS_ALLOWED_HEADERS: z.string().default('Content-Type,Authorization'),
  
  // API Documentation
  API_DOCS_ENABLED: z.coerce.boolean().default(true),
  API_DOCS_PATH: z.string().default('/api-docs'),
  
  // External Services
  WEATHER_API_KEY: z.string().optional(),
  WEATHER_API_URL: z.string().url().default('https://api.weatherapi.com/v1'),
  
  // Feature Flags
  FEATURE_FILE_UPLOAD: z.coerce.boolean().default(true),
  FEATURE_DATABASE_QUERY: z.coerce.boolean().default(true),
  FEATURE_WEATHER_SERVICE: z.coerce.boolean().default(true),
  
  // OAuth Configuration
  OAUTH_ENABLED: z.coerce.boolean().default(false),
  OAUTH_ISSUER_URL: z.string().url().optional(),
  OAUTH_CLIENT_ID: z.string().optional(),
  OAUTH_CLIENT_SECRET: z.string().optional(),
  OAUTH_REDIRECT_URIS: z.string().default('http://localhost:3000/auth/callback'),
  OAUTH_POST_LOGOUT_REDIRECT_URIS: z.string().default('http://localhost:3000'),
  OAUTH_SCOPE: z.string().default('openid profile email'),
});

// Base configuration type from schema
type ConfigBase = z.infer<typeof configSchema> & {
  // OAuth Configuration
  OAUTH_ENABLED: boolean;
  OAUTH_ISSUER_URL?: string;
  OAUTH_CLIENT_ID?: string;
  OAUTH_CLIENT_SECRET?: string;
  OAUTH_REDIRECT_URI?: string;
  OAUTH_SCOPE: string;
};

// Extended configuration type with utility methods
interface Config extends ConfigBase {
  // Utility methods
  isProduction(): boolean;
  isDevelopment(): boolean;
  isTest(): boolean;
  get<T extends keyof ConfigBase>(key: T): ConfigBase[T];
  getAll(): ConfigBase;
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private parsedConfig: ConfigBase;

  private constructor() {
    // Validate environment variables against the schema
    this.parsedConfig = this.loadConfig();
    
    // Create config object with utility methods
    this.config = {
      ...this.parsedConfig,
      isProduction: () => this.parsedConfig.NODE_ENV === 'production',
      isDevelopment: () => this.parsedConfig.NODE_ENV === 'development',
      isTest: () => this.parsedConfig.NODE_ENV === 'test',
      get: <K extends keyof ConfigBase>(key: K): ConfigBase[K] => {
        const value = this.parsedConfig[key];
        if (value === undefined) {
          throw new Error(`Configuration key '${key}' is not defined`);
        }
        return value;
      },
      getAll: () => ({ ...this.parsedConfig })
    } as Config;
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): ConfigBase {
    try {
      // For development, ensure we're loading from the project root
      if (process.env.NODE_ENV === 'development') {
        dotenv.config({ path: path.resolve(process.cwd(), '.env') });
      }

      const result = configSchema.safeParse(process.env);
      
      if (!result.success) {
        console.error('❌ Invalid environment variables:');
        result.error.issues.forEach(issue => {
          console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
        });
        process.exit(1);
      }
      
      return result.data;
    } catch (error) {
      console.error('❌ Failed to load configuration:', error);
      process.exit(1);
    }
  }

  public get<T extends keyof Config>(key: T): Config[T] {
    const value = this.config[key];
    if (value === undefined) {
      throw new Error(`Configuration key '${key}' is not defined`);
    }
    return value;
  }

  public getAll(): Config {
    return { ...this.config };
  }

  public isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  public isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }

  public isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }
}

// Export a singleton instance
export const config = ConfigManager.getInstance();

// For backward compatibility
export default config;
