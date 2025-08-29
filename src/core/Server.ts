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
import { AuthMiddleware } from '../middleware/auth.middleware';

type RPCMethod = (...params: any[]) => Promise<any>;

interface SecurityMiddleware {
  securityHeaders: RequestHandler;
  cors: RequestHandler;
  rateLimit: RequestHandler;
}

export interface AuthUser {
  id: string;
  email?: string;
  roles: string[];
  [key: string]: any;
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

export interface AuthMiddleware {
  initialize: RequestHandler;
  requireAuth(): RequestHandler;
  requireRole(role: string): RequestHandler;
  requireAnyRole(roles: string[]): RequestHandler;
  oauthService: OAuthService | null;
  logger: Logger;
}

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
  public readonly expressApp: Application; // Alias for app for backward compatibility
  private httpServer: HttpServer | null = null;
  private rpcHandlers: Map<string, RPCMethod> = new Map();
  private logger: Logger;
  private config: Config;
  private securityManager: SecurityManager;
  private authMiddleware: AuthMiddleware | null = null;
  private authService?: OAuthService;
  private securityMiddleware?: {
    cors: RequestHandler;
    rateLimit: RequestHandler;
    securityHeaders: RequestHandler;
  };

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.app = express();
    this.expressApp = this.app; // Alias for backward compatibility
    this.securityManager = new SecurityManager(logger);
    
    // Initialize the server
    // Use void operator to ignore the Promise since we can't use await in constructor
    this.initialize().catch(error => {
      this.logger.error('Failed to initialize server:', error);
      process.exit(1);
    });
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize security manager first
      const securityResult = await this.securityManager.initialize();
      
      // Store security middleware and auth service
      this.securityMiddleware = {
        cors: securityResult.security.cors,
        rateLimit: securityResult.security.rateLimit,
        securityHeaders: securityResult.security.securityHeaders
      };
      
      // Store auth middleware and service if available
      if (securityResult.auth) {
        this.authMiddleware = securityResult.auth.middleware;
        this.authService = securityResult.auth.service;
        
        // Only register auth routes if they exist
        if (securityResult.auth.routes) {
          this.app.use('/auth', securityResult.auth.routes);
        }
      }
      
      // Setup middleware after security is initialized
      await this.setupMiddleware();
      
      // Setup routes and error handling
      this.setupRoutes();
      this.setupErrorHandling();
      
      this.logger.info('Server initialized');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to initialize server', { error: errorMessage });
      throw error;
    }
  }

  private async setupMiddleware(): Promise<void> {
    if (!this.securityMiddleware) {
      throw new Error('Security middleware not initialized');
    }

    // Apply middleware in correct order
    this.logger.info('Setting up middleware...');
    
    // 1. Security headers first
    this.app.use(this.securityMiddleware.securityHeaders);
    
    // 2. CORS before other middleware to ensure it's applied to all responses
    this.app.use(this.securityMiddleware.cors);
    
    // 3. Compression
    this.app.use(compression());
    
    // 4. Rate limiting (except in test environment)
    if (process.env.NODE_ENV !== 'test' && this.securityMiddleware.rateLimit) {
      this.app.use(this.securityMiddleware.rateLimit);
    }
    
    // 5. Helmet for security headers (after CORS to avoid conflicts)
    this.app.use(helmet({
      crossOriginResourcePolicy: false, // Let CORS handle this
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'connect-src': ["'self'"],
        },
      },
    }));

    // Body parsing with size limit
    const maxRequestSize = this.config.server?.maxRequestSize || '10mb';
    this.app.use(bodyParser.json({ limit: maxRequestSize }));
    this.app.use(bodyParser.urlencoded({ extended: true }));

    // Add auth middleware if available
    if (this.authMiddleware) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        // Check if initialize exists before calling it
        if (typeof this.authMiddleware?.initialize === 'function') {
          return this.authMiddleware.initialize(req, res, next);
        }
        return next();
      });
    }

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        body: req.body
      });
      next();
    });
  }

  private async handleRpcRequest(req: Request): Promise<any> {
    const { method, params, id } = req.body;
    
    if (!method) {
      return {
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Method is required' },
        id: id || null
      };
    }
    
    const rpcMethod = this.rpcHandlers.get(method);
    if (!rpcMethod) {
      return {
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id: id || null
      };
    }
    
    try {
      const result = await rpcMethod(params || {});
      return { jsonrpc: '2.0', result, id };
      
    } catch (error: any) {
      const errorMessage = error.message || 'Internal server error';
      const errorCode = typeof error.code === 'number' ? error.code : -32603;
      
      this.logger.error('RPC Error:', { 
        error: errorMessage,
        code: errorCode,
        stack: error.stack,
        method: req.body?.method,
        params: req.body?.params 
      });
      
      return {
        jsonrpc: '2.0',
        error: {
          code: errorCode,
          message: errorMessage,
          data: process.env.NODE_ENV === 'development' ? {
            message: errorMessage,
            stack: error.stack
          } : undefined
        },
        id: id || null
      };
    }
  }

  private setupRoutes(): void {
    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      const logInfo = { 
        ip: req.ip, 
        userAgent: req.get('User-Agent'),
        path: req.path
      };
      
      this.logger.info('GET /', logInfo);
      
      // Set CORS headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      try {
        // Return API information
        res.json({
          name: 'MCP Server',
          version: '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          documentation: {
            endpoints: [
              { 
                path: '/', 
                method: 'GET', 
                description: 'API information and documentation',
                response: {
                  name: 'string',
                  version: 'string',
                  status: 'string',
                  timestamp: 'string',
                  documentation: 'object'
                }
              },
              {
                path: '/health',
                method: 'GET',
                description: 'Health check endpoint',
                response: {
                  status: 'string',
                  timestamp: 'string'
                }
              },
              {
                path: '/rpc',
                method: 'POST',
                description: 'JSON-RPC 2.0 endpoint',
                request: {
                  jsonrpc: '2.0',
                  method: 'string',
                  params: 'object',
                  id: 'string|number|null'
                },
                response: {
                  jsonrpc: '2.0',
                  result: 'any',
                  error: {
                    code: 'number',
                    message: 'string',
                    data: 'any'
                  },
                  id: 'string|number|null'
                }
              }
            ],
            availableMethods: [
              'weather.getCurrent',
              'file.read',
              'file.write',
              'database.query'
            ]
          }
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Error in root route:', { error: errorMessage });
        return res.json({
          status: 'error',
          message: errorMessage,
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version
        });
      }
    });

    // API documentation (public)
    this.app.get('/docs', (req: Request, res: Response) => {
      res.redirect('/api-docs');
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version
      });
    });

    // JSON-RPC endpoint (protected if auth is enabled)
    const rpcMiddlewares: RequestHandler[] = [];
    
    // Add auth middleware if available
    if (this.authMiddleware?.requireAuth) {
      rpcMiddlewares.push(this.authMiddleware.requireAuth());
    }
    
    // Add the main RPC handler
    rpcMiddlewares.push(async (req: Request, res: Response) => {
      try {
        const result = await this.handleRpcRequest(req);
        res.json(result);
      } catch (error) {
        this.logger.error('RPC Error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: process.env.NODE_ENV === 'development' ? error.message : undefined
          },
          id: req.body.id || null
        });
      }
    });
    
    // Register the RPC route with all middlewares
    this.app.post('/rpc', ...rpcMiddlewares);
    
    // Add auth routes if OAuth is enabled
    if (this.authMiddleware?.routes) {
      this.app.use('/auth', this.authMiddleware.routes);
      this.logger.info('Authentication routes enabled at /auth');
    }
    
    // 404 handler for API routes
    this.app.use('/api/*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`
      });
    });
    
    // Serve static files from client in production
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static('client/dist'));
      this.app.get('*', (req: Request, res: Response) => {
        res.sendFile('index.html', { root: 'client/dist' });
      });
    }
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `The requested resource ${req.path} was not found.`
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error:', err);
      
      if (err instanceof MCPError) {
        return res.status(err.statusCode).json({
          error: err.name,
          message: err.message,
          code: err.code
        });
      }

      // Default error response
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred.'
      });
    });
  }

  public registerRPCMethod(name: string, method: RPCMethod): void {
    this.rpcHandlers.set(name, method);
  }

  public async start(port: number = 3000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!this.httpServer) {
          this.httpServer = createServer(this.app);
        }

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
          resolve();
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to start server: ${errorMessage}`);
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        this.logger.warn('Server not running');
        resolve();
        return;
      }

      this.httpServer.close((err) => {
        if (err) {
          this.logger.error('Error stopping server', { error: err });
          reject(err);
          return;
        }
        this.logger.info('Server stopped');
        this.httpServer = null;
        resolve();
      });
    });
  }
}
