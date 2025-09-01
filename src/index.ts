#!/usr/bin/env node

/**
 * MCP Server - Model Context Protocol Server
 * 
 * This is the main entry point for the MCP server which provides
 * a standardized way for AI models to interact with external tools and services.
 */

// Core Node.js modules
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// Third-party dependencies
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import winston from 'winston';
import cors from 'cors';
import { AuthUser } from './types/AuthUser';

// Application configuration and types
import config, { Config } from './config';
import { MCPServer } from './core/Server';
import { setupContainer } from './container';
import { MCPError } from './utils/errors';
import { FileSystemService } from './services/FileSystemService';
import { AuthService } from './services/auth/AuthService';
import { AuthController } from './controllers/AuthController';
import { createAuthMiddleware } from './middleware/auth.middleware';
import { WeatherService } from './services/WeatherService';
import { DatabaseService } from './services/DatabaseService';
import { OAuthService } from './services/OAuthService';
import { MFAService } from './services/MFAService';
import { UserService } from './services/UserService';

// Create a Winston logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',  
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'mcp-server' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
}) as any; // Type assertion to avoid Winston's complex types


// Create an instance of the MCP server
const server = new MCPServer(config, logger);

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  // In production, you might want to perform cleanup and then exit
  // process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // In production, you might want to perform cleanup and then exit
  // process.exit(1);
});

// Handle process termination signals
const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

// Graceful shutdown function
const gracefulShutdown = async (server: MCPServer, signal: NodeJS.Signals) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close the server
    await server.stop();
    logger.info('Server has been stopped');
    
    // Close database connections, etc.
    // await database.close();
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Main application function
const startServer = async () => {
  try {
    logger.info('Starting MCP Server...');
    logger.debug('Configuration:', { config: JSON.stringify(config, null, 2) });

    // Setup dependency injection container
    await setupContainer();
    
    // Create server instance with the correct config and logger
    // Create server configuration
    const serverConfig: Config = {
      server: {
        port: parseInt(process.env.PORT || '3000', 10),
        environment: process.env.NODE_ENV || 'development',
        maxRequestSize: '10mb',
        shutdownTimeout: 10000 // 10 seconds
      },
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_TO_FILE === 'true' ? process.env.LOG_FILE_PATH || 'logs/app.log' : '',
        console: true
      },
      database: {
        path: process.env.DB_PATH || './data/mcp-db.sqlite',
        logging: process.env.DB_LOGGING === 'true'
      },
      weather: {
        apiKey: process.env.WEATHER_API_KEY || '',
        baseUrl: process.env.WEATHER_API_URL || 'https://api.weatherapi.com/v1',
        timeout: 5000
      },
      fileSystem: {
        sandboxDir: process.env.BASE_STORAGE_PATH ? path.join(process.env.BASE_STORAGE_PATH, 'sandbox') : './storage/sandbox',
        maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)
      },
      security: {
        oauth: {
          enabled: process.env.OAUTH_ENABLED === 'true',
          issuerUrl: process.env.OAUTH_ISSUER_URL || 'https://accounts.google.com',
          clientId: process.env.OAUTH_CLIENT_ID || '',
          clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
          redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
          scope: process.env.OAUTH_SCOPE || 'openid profile email'
        },
        cors: {
          enabled: true,
          allowedOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000').split(',').map(s => s.trim()),
          methods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS').split(',').map(s => s.trim()),
          allowedHeaders: (process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization').split(',').map(s => s.trim()),
          credentials: true,
          maxAge: 600 // 10 minutes
        },
        rateLimit: {
          enabled: true,
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
          max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
          message: 'Too many requests, please try again later.',
          trustProxy: true
        },
        headers: {
          hsts: {
            enabled: true,
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
          },
          xssFilter: true,
          noSniff: true,
          hidePoweredBy: true,
          frameguard: {
            enabled: true,
            action: 'SAMEORIGIN'
          },
          contentSecurityPolicy: {
            enabled: true,
            directives: {
              'default-src': ["'self'"],
              'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
              'style-src': ["'self'", "'unsafe-inline'"],
              'img-src': ["'self'", 'data:', 'https:'],
              'font-src': ["'self'", 'https:', 'data:'],
              'connect-src': ["'self'", 'https:']
            }
          }
        },
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAgeDays: 90,
          historySize: 5
        },
        apiSecurity: {
          enableRequestValidation: true,
          enableResponseValidation: true,
          maxRequestSize: '10mb',
          enableQueryValidation: true,
          enableParamValidation: true
        },
        session: {
          secret: process.env.JWT_SECRET || 'your-secure-jwt-secret-min-32-chars-long',
          name: 'mcp.sid',
          resave: false,
          saveUninitialized: false,
          rolling: true,
          cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'lax',
            path: '/',
            domain: process.env.SESSION_DOMAIN || 'localhost'
          }
        },
        jwt: {
          secret: process.env.JWT_SECRET || 'your-secure-jwt-secret-min-32-chars-long',
          algorithm: 'HS256',
          expiresIn: process.env.JWT_EXPIRES_IN || '1d',
          issuer: 'mcp-server',
          audience: 'mcp-client'
        },
        logging: {
          enableSecurityLogging: true,
          logSensitiveData: false,
          logFailedLoginAttempts: true,
          logSuccessfulLogins: true
        }
      }
    };

    // Create server instance with the config and logger
    const server = new MCPServer(serverConfig, logger);

    
    // Add middleware
    const maxRequestSize = '10mb'; // Default max request size
    server.app.use(express.json({ limit: maxRequestSize }));
    
    // Configure CORS
    const corsOptions = {
      origin: serverConfig.security.cors.allowedOrigins,
      methods: serverConfig.security.cors.methods,
      allowedHeaders: serverConfig.security.cors.allowedHeaders,
      credentials: serverConfig.security.cors.credentials,
      maxAge: serverConfig.security.cors.maxAge
    };
    
    server.app.use(cors(corsOptions));

    // Serve static files from the client build directory if it exists
    const clientBuildPath = path.join(__dirname, '../../client/dist');
    if (fs.existsSync(clientBuildPath)) {
      server.app.use(express.static(clientBuildPath));
    }

    // Root route - serves the frontend or API info
    server.app.get('/', (req: Request, res: Response) => {
      // If we have a client build, let the client-side routing handle it
      if (fs.existsSync(clientBuildPath)) {
        return res.sendFile(path.join(clientBuildPath, 'index.html'));
      }
      
      // Otherwise, return API info
      res.json({
        name: 'MCP Server',
        version: '1.0.0',
        status: 'running',
        documentation: '/api-docs',
        timestamp: new Date().toISOString()
      });
    });

    // Initialize database service
    const databaseService = new DatabaseService({
      path: config.database.path,
      logging: config.database.logging
    }, logger);
    
    // Initialize weather service if API key is provided
    let weatherService: WeatherService | null = null;
    if (config.weather.apiKey) {
      try {
        weatherService = new WeatherService({
          apiKey: config.weather.apiKey,
          baseUrl: config.weather.baseUrl,
          timeout: config.weather.timeout
        });
        logger.info('Weather service initialized');
      } catch (error) {
        logger.error('Failed to initialize weather service', { error });
      }
    } else {
      logger.warn('Weather service disabled: No API key provided');
    }
    
    const fileSystemConfig = {
      basePath: config.fileSystem.sandboxDir,
      maxFileSizeMB: config.fileSystem.maxFileSizeMB,
      sandboxDir: path.join(config.fileSystem.sandboxDir, 'sandbox')
    };
    const fileSystemService = new FileSystemService(fileSystemConfig);
  
    // Initialize authentication
    const authService = new AuthService(databaseService, logger);
    const authController = new AuthController(authService);
    
    // Initialize OAuth, MFA, and User services for AuthMiddleware
    const oauthConfig = {
      issuerUrl: process.env.OAUTH_ISSUER_URL || 'http://localhost:3000',
      clientId: process.env.OAUTH_CLIENT_ID || 'mcp-client',
      clientSecret: process.env.OAUTH_CLIENT_SECRET || 'change-me-in-production',
      redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
      scope: 'openid profile email'
    };
    
    const oauthService = new OAuthService(oauthConfig, logger);
    const mfaService = new MFAService();
    const userService = new UserService();
    
    // Set logger for services that need it
    (mfaService as any).logger = logger;
    (userService as any).logger = logger;
    
    // Create auth middleware using the factory function
    const authMiddleware = createAuthMiddleware(
      oauthService,
      logger,
      mfaService,
      userService
    );
    
    // Create a wrapper function for the auth middleware that matches the expected interface
    const authenticate = (req: Request, res: Response, next: NextFunction) => {
      return authMiddleware.requireAuth()(req, res, next);
    };

    // Register auth routes (public)
    server.app.post('/api/auth/register', (req, res) => authController.register(req, res));
    server.app.post('/api/auth/login', (req, res) => authController.login(req, res));
    server.app.post('/api/auth/refresh-token', (req, res) => authController.refreshToken(req, res));
    server.app.post('/api/auth/logout', authenticate, (req, res) => authController.logout(req, res));
  
    // Protected routes (require authentication)
    server.app.get(
      '/api/auth/me',
      authenticate,
      (req: Request, res: Response) => {
        res.json({ user: req.user });
      }
    );

    // Example protected route with role-based access
    server.app.get(
      '/api/admin/dashboard',
      [authenticate, (req: Request, res: Response, next: NextFunction) => {
        if (req.user?.roles?.includes('admin')) {
          return next();
        }
        res.status(403).json({ error: 'Insufficient permissions' });
      }],
      (_req: Request, res: Response) => {
        res.json({ message: 'Admin dashboard' });
      }
    );

    // Root API endpoint
    server.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'MCP Server API',
        version: '1.0.0',
        endpoints: [
          { path: '/api/auth/register', method: 'POST', description: 'Register a new user' },
          { path: '/api/auth/login', method: 'POST', description: 'Login' },
          { path: '/api/auth/refresh-token', method: 'POST', description: 'Refresh access token' },
          { path: '/api/auth/me', method: 'GET', description: 'Get current user profile' },
          { path: '/api/admin/dashboard', method: 'GET', description: 'Admin dashboard (requires admin role)' },
          { path: '/rpc', method: 'POST', description: 'JSON-RPC 2.0 endpoint' },
        ],
        documentation: '/api-docs',
        timestamp: new Date().toISOString()
      });
    });

    // Apply authentication middleware to all other API routes
    server.app.use('/api', (req, res, next) => {
      // Skip auth for public routes
      if (req.path.startsWith('/api/auth/') || req.path === '/api/health') {
        return next();
      }
      
      // Apply auth middleware to all other API routes
      return authMiddleware.requireAuth()(req, res, next);
    });

    // Error handling middleware
    server.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

    // Register RPC methods
    if (weatherService) {
      server.registerRPCMethod('weather.getCurrent', async (params: any) => {
        if (!params || typeof params !== 'object') {
          throw new Error('Invalid parameters: expected an object with city and optional country');
        }
        return await weatherService.getCurrentWeather({
          city: params.city || '',
          country: params.country,
          units: params.units || 'metric',
          lang: params.lang || 'en'
        });
      });
    } else {
      server.registerRPCMethod('weather.getCurrent', async () => {
        throw new Error('Weather service is not configured');
      });
    }
    
    server.registerRPCMethod('filesystem.readFile', async (params: any) => 
      await fileSystemService.readFile(params)
    );
    
    server.registerRPCMethod('filesystem.writeFile', async (params: any) => 
      await fileSystemService.writeFile(params)
    );
    
    server.registerRPCMethod('file.list', async (params: any) => 
      await fileSystemService.listDirectory({ 
        path: params?.path || '/',
        recursive: params?.recursive || false
      })
    );
    
    server.registerRPCMethod('database.query', async (params: any) => 
      await databaseService.query(params)
    );

    // Health check RPC method
    server.registerRPCMethod('health.check', async () => {
      const checks = {
        database: 'ok',
        databaseReadOnly: false,
        fileSystem: 'ok',
        memoryUsage: {
          rss: process.memoryUsage().rss,
          heapTotal: process.memoryUsage().heapTotal,
          heapUsed: process.memoryUsage().heapUsed,
        },
        uptime: process.uptime(),
      };

      // Test database connection with a simple read query
      try {
        // First try a read-only query
        await databaseService.query({ sql: 'SELECT 1 as test', readOnly: true });
        
        // If that works, try a write operation if not in read-only mode
        try {
          await databaseService.query({ sql: 'SELECT 1' });
        } catch (writeError) {
          checks.databaseReadOnly = true;
          logger.warn('Database is in read-only mode', { error: writeError });
        }
      } catch (error) {
        checks.database = 'error';
        logger.error('Database health check failed', { error });
      }

      // Test filesystem access
      try {
        // Try to read the current directory
        const testPath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(testPath)) {
          // Just check if we can read the file
          fs.readFileSync(testPath, 'utf8');
        } else {
          throw new Error('Test file not found');
        }
      } catch (error) {
        checks.fileSystem = 'error';
        logger.error('Filesystem health check failed', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }

      const isHealthy = checks.database === 'ok' && checks.fileSystem === 'ok';
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        ...checks,
      };
    });

    // Start the server
    const port = config.server.port || 3000;
    const httpServer = await server.start(port);

    // Register signal handlers for graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        gracefulShutdown(server, signal).catch(error => {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        });
      });
    });

    const environment = process.env.NODE_ENV || 'development';
    logger.info(`MCP Server is running in ${environment} mode on port ${port}`);
  } catch (error) {
    logger.error('Failed to start MCP Server:', error);
    process.exit(1);
  }
};

// Start the application
if (require.main === module) {
  startServer();
}

export { startServer };
