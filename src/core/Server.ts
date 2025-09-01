import { Server as HttpServer, createServer } from 'http';
import express, {
  Request,
  Response,
  NextFunction,
  Application,
  RequestHandler,
  ErrorRequestHandler,
  RequestHandler as ExpressRequestHandler,
  Router
} from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import compression from 'compression';
import { OAuthService } from '../services/OAuthService';
import { Logger } from 'winston';
import { Config } from '../config';
import SecurityManager from './SecurityManager';
import { AuthUser } from '../middleware/auth.middleware';

type RPCMethod = (...params: any[]) => Promise<any>;

interface SecurityMiddleware {
  securityHeaders: RequestHandler;
  cors: RequestHandler;
  rateLimit: RequestHandler;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      hasRole(role: string): boolean;
      hasAnyRole(roles: string[]): boolean;
    }
  }
}

import { AuthMiddleware as AuthMiddlewareImpl } from '../middleware/auth.middleware';

export type AuthMiddleware = AuthMiddlewareImpl;

interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  apiKeys?: string[];
}

interface SecurityManagerResult {
  auth: {
    middleware: AuthMiddleware;
    service: OAuthService;
    routes: Router;
  };
  security: {
    cors: RequestHandler;
    rateLimit: RequestHandler;
    securityHeaders: RequestHandler;
  };
}

export class MCPServer {
  public readonly app: Application;
  public readonly expressApp: Application;
  public httpServer: HttpServer | null = null;
  private rpcHandlers: Map<string, RPCMethod> = new Map();
  private logger: Logger;
  private config: Config;
  private securityManager: SecurityManager;
  private authMiddleware: AuthMiddleware | null = null;
  private authService: OAuthService | null = null;
  private securityMiddleware: SecurityMiddleware;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.app = express();
    this.expressApp = this.app;
    this.securityManager = new SecurityManager(logger);
    
    // Initialize with default values
    this.authService = null;
    this.authMiddleware = null;
    
    this.securityMiddleware = {
      cors: (req: Request, res: Response, next: NextFunction) => next(),
      rateLimit: (req: Request, res: Response, next: NextFunction) => next(),
      securityHeaders: (req: Request, res: Response, next: NextFunction) => next()
    };
    
    // Initialize the server
    this.initialize().catch(error => {
      this.logger.error('Failed to initialize server:', error);
      process.exit(1);
    });
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize security
      const securityResult = await this.securityManager.initialize();
      
      // Update security middleware (always available)
      if (securityResult?.security) {
        this.securityMiddleware = securityResult.security;
      }
      
      // Update auth middleware and service if available
      if (securityResult?.auth) {
        this.authMiddleware = securityResult.auth.middleware;
        this.authService = securityResult.auth.service;
        
        // Register auth routes if they exist and auth is enabled
        if (securityResult.auth.routes) {
          this.app.use('/auth', securityResult.auth.routes);
        }
      } else {
        // If no auth is configured, use a simple middleware that just calls next()
        this.app.use((req, res, next) => next());
        this.logger.warn('No authentication configured. Running in unauthenticated mode.');
      }
      
      // Setup middleware
      await this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      this.logger.info('Server initialized');
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed to initialize server', { 
          error: error.message,
          stack: error.stack 
        });
      } else {
        this.logger.error('Failed to initialize server', { error: String(error) });
      }
      throw error;
    }
  }

  private async setupMiddleware(): Promise<void> {
    // Security middleware
    this.app.use(helmet());
    this.app.use(compression());
    
    // Body parsing
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    
    // Security middleware from security manager
    this.app.use(this.securityMiddleware.securityHeaders);
    this.app.use(this.securityMiddleware.cors);
    this.app.use(this.securityMiddleware.rateLimit);
    
    // Logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        query: req.query,
        body: req.body
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });
    
    // API routes
    this.app.use('/api', (req: Request, res: Response, next: NextFunction) => {
      // API-specific middleware here
      next();
    });
    
    // OAuth routes
    if (this.config.oauth?.enabled) {
      try {
        const { createOAuthRoutes } = require('../routes/oauth.routes');
        const oauthRoutes = createOAuthRoutes(this.logger);
        this.app.use('/auth', oauthRoutes);
        this.logger.info('OAuth routes initialized');
      } catch (error) {
        this.logger.error('Failed to initialize OAuth routes:', error);
      }
    } else {
      this.logger.warn('OAuth is not configured. Some features may be limited.');
    }
    
    // RPC endpoint
    this.app.post('/rpc', (req: Request, res: Response, next: NextFunction) => {
      this.handleRpcRequest(req, res, next).catch(next);
    });
    
    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static('client/dist'));
      this.app.get('*', (req: Request, res: Response) => {
        res.sendFile('index.html', { root: 'client/dist' });
      });
    }
  }

  private setupErrorHandling(): void {
    // Error handling middleware
    const errorHandler: ErrorRequestHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
      if (err instanceof Error) {
        this.logger.error('Unhandled error:', {
          error: err.message,
          stack: err.stack,
          path: req.path,
          method: req.method
        });

        res.status(500).json({
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
          ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
      } else {
        const errorMessage = String(err);
        this.logger.error('Unhandled non-Error exception:', {
          error: errorMessage,
          path: req.path,
          method: req.method
        });

        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
          ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
        });
      }
    };
    
    this.app.use(errorHandler);
  }

  public registerRPCMethod(name: string, method: RPCMethod): void {
    this.rpcHandlers.set(name, method);
  }

  private async handleRpcRequest(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    this.logger.debug('RPC Request:', {
      method: req.method,
      url: req.url,
      body: req.body,
      headers: req.headers
    });

    try {
      if (!req.body) {
        const error = new Error('Request body is empty');
        this.logger.error('RPC Error:', { error: error.message });
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Request body is required'
        });
      }

      const { method, params = [] } = req.body;
      
      if (!method || typeof method !== 'string') {
        const error = new Error('Missing or invalid method name');
        this.logger.error('RPC Error:', { error: error.message, method });
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Missing or invalid method name',
          details: { method }
        });
      }
      
      const handler = this.rpcHandlers.get(method);
      if (!handler) {
        const error = new Error(`Method '${method}' not found`);
        this.logger.error('RPC Error:', { 
          error: error.message, 
          availableMethods: Array.from(this.rpcHandlers.keys()) 
        });
        return res.status(404).json({
          error: 'Method not found',
          message: `Method '${method}' does not exist`,
          availableMethods: Array.from(this.rpcHandlers.keys())
        });
      }
      
      try {
        // Handle both array and object parameters
        const result = Array.isArray(params) 
          ? await handler(...params)
          : await handler(params || {});
          
        this.logger.debug('RPC Success:', { method, result });
        return res.json({ result });
      } catch (error: any) {
        this.logger.error('RPC Handler Error:', { 
          method, 
          error: error.message, 
          stack: error.stack,
          params
        });
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    } catch (error: any) {
      this.logger.error('Unexpected RPC Error:', { 
        error: error.message, 
        stack: error.stack,
        body: req.body
      });
      next(error);
    }
  }

  public async start(port: number = 3000): Promise<HttpServer> {
    return new Promise<HttpServer>((resolve, reject) => {
      try {
        if (this.httpServer) {
          this.logger.warn('Server is already running');
          return resolve(this.httpServer);
        }

        this.httpServer = createServer(this.app);

        this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
          if (error.syscall !== 'listen') {
            reject(error);
            return;
          }

          // Handle specific listen errors with friendly messages
          switch (error.code) {
            case 'EACCES':
              this.logger.error(`Port ${port} requires elevated privileges`);
              reject(new Error(`Port ${port} requires elevated privileges`));
              break;
            case 'EADDRINUSE':
              this.logger.error(`Port ${port} is already in use`);
              reject(new Error(`Port ${port} is already in use`));
              break;
            default:
              reject(error);
          }
        });

        this.httpServer.listen(port, () => {
          this.logger.info(`Server running on port ${port}`);
          if (this.httpServer) {
            resolve(this.httpServer);
          } else {
            reject(new Error('Failed to start server: HTTP server is null'));
          }
        });
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error('Failed to start server', { 
            error: error.message,
            stack: error.stack 
          });
        } else {
          this.logger.error('Failed to start server', { error: String(error) });
        }
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.httpServer) {
        this.logger.warn('Server not running');
        resolve();
        return;
      }

      // Store a reference to the server before clearing it
      const server = this.httpServer;
      this.httpServer = null;

      server.close((err) => {
        if (err) {
          this.logger.error('Error stopping server', { error: err });
          reject(err);
          return;
        }
        this.logger.info('Server stopped');
        resolve();
      });
    });
  }
}
