#!/usr/bin/env node

/**
 * MCP Server - Model Context Protocol Server
 * 
 * This is the main entry point for the MCP server which provides
 * a standardized way for AI models to interact with external tools and services.
 */

import 'reflect-metadata';
import { config } from './config';
import logger from './utils/logger';
import { MCPServer } from './core/Server';
import * as fs from 'fs';
import * as path from 'path';
import { WeatherService } from './services/WeatherService';
import { FileSystemService } from './services/FileSystemService';
import { DatabaseService } from './services/DatabaseService';
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

    // Create server instance
    const server = new MCPServer(config, logger);

    // Initialize services
    const weatherService = new WeatherService(config.weather);
    const fileSystemService = new FileSystemService(config.fileSystem);
    const databaseService = new DatabaseService(config.database, logger);

    // Register RPC methods
    server.registerMethod('weather.getCurrent', (params) => 
      weatherService.getCurrentWeather(params)
    );
    
    server.registerMethod('filesystem.readFile', (params) => 
      fileSystemService.readFile(params)
    );
    
    server.registerMethod('filesystem.writeFile', (params) => 
      fileSystemService.writeFile(params)
    );
    
    server.registerMethod('database.query', (params) => 
      databaseService.query(params)
    );

    // Health check RPC method
    server.registerMethod('health.check', async () => {
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
