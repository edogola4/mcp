#!/usr/bin/env node

/**
 * MCP Server - Model Context Protocol Server
 * 
 * This is the main entry point for the MCP server which provides
 * a standardized way for AI models to interact with external tools and services.
 */

import express, { Request, Response, NextFunction, RequestHandler, Request as ExpressRequest } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

type RequestWithUser = Request & {
  user?: {
    id: string;
    email?: string;
    roles?: string[];
  };
};
import { config } from './config';
import logger from './utils/logger';
import { MCPServer } from './core/Server';
import { setupContainer } from './container';
import * as fs from 'fs';
import * as path from 'path';
import cors from 'cors';
import { WeatherService } from './services/WeatherService';
import { FileSystemService } from './services/FileSystemService';
import { DatabaseService } from './services/DatabaseService';
import { AuthService } from './services/auth/AuthService';
import { AuthController } from './controllers/AuthController';
import { AuthMiddleware } from './middleware/auth/auth.middleware';
import { MCPError } from './utils/errors';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  // In production, you might want to perform cleanup and then exit
  // process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
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
    const server = new MCPServer(config, logger);

    // Add middleware
    server.app.use(express.json({ limit: config.server.maxRequestSize }));
    server.app.use(cors({
      origin: config.security.cors.origin,
      methods: config.security.cors.methods,
      allowedHeaders: config.security.cors.allowedHeaders,
      credentials: config.security.cors.credentials
    }));

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

    // Initialize services with correct constructor signatures
    const databaseService = new DatabaseService(config.database, logger);
    const weatherService = new WeatherService(config.weather);
    const fileSystemService = new FileSystemService(config.fileSystem);
  
    // Initialize authentication
    const authService = new AuthService(databaseService, logger);
    const authController = new AuthController(authService);
    const authMiddleware = new AuthMiddleware(authService);

    // Register auth routes (public)
    server.app.post('/api/auth/register', (req, res) => authController.register(req, res));
    server.app.post('/api/auth/login', (req, res) => authController.login(req, res));
    server.app.post('/api/auth/refresh-token', (req, res) => authController.refreshToken(req, res));
    server.app.post('/api/auth/logout', (req, res) => authController.logout(req, res));
  
    // Protected routes (require authentication)
    server.app.get(
      '/api/auth/me',
      authMiddleware.authenticate(),
      (req, res) => authController.getProfile(req, res)
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
          { path: '/rpc', method: 'POST', description: 'JSON-RPC 2.0 endpoint' },
        ],
        documentation: '/api-docs',
        timestamp: new Date().toISOString()
      });
    });

    // Apply authentication middleware to all other API routes
    server.app.use('/api', (req, res, next) => {
      // Skip auth for public routes
      if (req.path === '' || req.path === '/' || req.path.startsWith('/auth/') || req.path === '/health') {
        return next();
      }
      return authMiddleware.authenticate()(req, res, next);
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
    server.registerRPCMethod('weather.getCurrent', async (params: any) => 
      await weatherService.getCurrentWeather(params)
    );
    
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
    await server.start();

    // Register signal handlers for graceful shutdown
    shutdownSignals.forEach(signal => {
      process.on(signal, () => gracefulShutdown(server, signal));
    });

    logger.info(`MCP Server is running in ${config.server.environment} mode on port ${config.server.port}`);
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
