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
    
    server.registerMethod('file.read', (params) => 
      fileSystemService.readFile(params)
    );
    
    server.registerMethod('file.write', (params) => 
      fileSystemService.writeFile(params)
    );
    
    server.registerMethod('database.query', (params) => 
      databaseService.query(params)
    );

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
