import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DatabaseService } from '../services/DatabaseService';
import { FileSystemService } from '../services/FileSystemService';
import { Logger } from 'winston';
import createLogger from '../utils/logger';
import * as fs from 'fs';

export const healthCheckRouter = Router();

// Health check endpoint
healthCheckRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const logger = createLogger.child({ service: 'health-check' });
  const checks = {
    database: 'ok',
    fileSystem: 'ok',
    memoryUsage: {
      rss: process.memoryUsage().rss,
      heapTotal: process.memoryUsage().heapTotal,
      heapUsed: process.memoryUsage().heapUsed,
    },
    uptime: process.uptime(),
  };

  // Check database connection
  try {
    const dbService = new DatabaseService(
      {
        path: process.env.DB_PATH || './data/mcp-db.sqlite',
        logging: false
      },
      logger
    );
    await dbService.query({ sql: 'SELECT 1' });
  } catch (error) {
    checks.database = 'error';
    logger.error('Database health check failed', { error });
  }

  // Check file system access
  try {
    const fsService = new FileSystemService({
      sandboxDir: process.env.FS_SANDBOX_DIR || 'sandbox',
      maxFileSizeMB: parseInt(process.env.FS_MAX_FILE_SIZE_MB || '10', 10)
    });
    // List files in the current directory as a basic check
    await fs.promises.readdir('.');
  } catch (error) {
    checks.fileSystem = 'error';
    logger.error('Filesystem health check failed', { error });
  }

  const isHealthy = checks.database === 'ok' && checks.fileSystem === 'ok';
  const status = isHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;

  res.status(status).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    ...checks,
  });
});

// Readiness check endpoint
healthCheckRouter.get('/ready', (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// Liveness check endpoint
healthCheckRouter.get('/live', (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});
