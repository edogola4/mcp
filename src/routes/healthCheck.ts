import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import { DatabaseService } from '../services/DatabaseService';
import { FileSystemService } from '../services/FileSystemService';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export const healthCheckRouter = Router();

// Health check endpoint
healthCheckRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const logger: Logger = createLogger('health-check');
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
    const dbService = new DatabaseService(config.get('database'), logger);
    await dbService.query({ sql: 'SELECT 1' });
  } catch (error) {
    checks.database = 'error';
    logger.error('Database health check failed', { error });
  }

  // Check file system access
  try {
    const fsService = new FileSystemService(config, logger);
    await fsService.readDir({ path: '.' });
  } catch (error) {
    checks.fileSystem = 'error';
    logger.error('Filesystem health check failed', { error });
  }

  const isHealthy = checks.database === 'ok' && checks.fileSystem === 'ok';
  const status = isHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;

  res.status(status).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
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
