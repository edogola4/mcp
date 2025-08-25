import * as jayson from 'jayson';
import { Server as HttpServer, createServer } from 'http';
import express, { Request, Response, NextFunction, Application } from 'express';
import bodyParser from 'body-parser';
import cors, { CorsOptions } from 'cors';
import { Logger } from 'winston';
import { MCPError } from '../utils/errors';
import { Config, SecurityConfig } from '../config';

type RPCMethod = (params: any) => Promise<any>;

export class MCPServer {
  public app: Application;
  private httpServer: HttpServer | null = null;
  private rpcServer: jayson.Server;
  private methods: Map<string, RPCMethod> = new Map();
  private logger: Logger;
  private config: Config;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.rpcServer = new jayson.Server({});
    
    // Override the method handler
    this.rpcServer.methods = this.methods as any;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    const security = this.config.security as SecurityConfig;
    const corsOptions: CorsOptions | undefined = security?.cors ? {
      origin: security.cors.origin,
      methods: security.cors.methods,
      allowedHeaders: security.cors.allowedHeaders,
      credentials: security.cors.credentials,
    } : undefined;
    
    this.app.use(cors(corsOptions));

    // Body parsing
    this.app.use(bodyParser.json({ limit: this.config.server.maxRequestSize }));
    this.app.use(bodyParser.urlencoded({ extended: true }));

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

  private setupRoutes(): void {
    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      this.logger.info('GET /', { 
        ip: req.ip, 
        userAgent: req.get('User-Agent'), 
        body: req.body 
      });
      
      // Set CORS headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      
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
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred'
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
      });
    });

    // JSON-RPC endpoint
    this.app.post('/rpc', (req: Request, res: Response) => {
      // @ts-ignore - jayson types are not perfect
      this.rpcServer.call(req.body, req, (error: any, success: any) => {
        if (error) {
          this.logger.error('RPC Error:', error);
          return res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: error.code || -32603,
              message: error.message || 'Internal error',
              data: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            id: req.body?.id || null,
          });
        }
        
        if (success) {
          return res.json(success);
        }
        
        // If no response was generated, return a method not found error
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found',
          },
          id: req.body?.id || null,
        });
      });
    });
  }

  private setupErrorHandling(): void {
    // Handle 404
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
      });
    });

    // Handle errors
    this.app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      this.logger.error('Unhandled error:', err);

      if (err instanceof MCPError) {
        return res.status(err.statusCode || 500).json({
          error: err.name,
          message: err.message,
          ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
      }

      // Default error response
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && { 
          details: err.message || 'No error details available',
          stack: err.stack 
        })
      });
    });
  }

  public registerMethod(name: string, method: RPCMethod): void {
    this.methods.set(name, method);
  }

  // Removed duplicate method implementations

  public start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.httpServer) {
        this.httpServer = createServer(this.app);
      }
      
      // Get port from config
      const port = this.config.server.port;
      const host = '0.0.0.0'; // Explicitly bind to all network interfaces
      
      // Setup WebSocket server if enabled in the future
      // if (this.config.websocket?.enabled) {
      //   this.setupWebSocket();
      //   this.logger.info('WebSocket support is enabled');
      // }

      this.httpServer.listen(port, host, () => {
        this.logger.info(`Server running on http://${host}:${port}`);
        this.logger.info(`MCP Server is running in ${this.config.server.environment} mode`);
        resolve();
      });
      
      // Handle server errors
      this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          this.logger.error(`Port ${port} is already in use`);
        } else {
          this.logger.error('Server error:', error);
        }
        process.exit(1);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        resolve();
        return;
      }

      this.httpServer.close((err?: Error) => {
        if (err) {
          this.logger.error('Error stopping server:', err);
          reject(err);
          return;
        }
        this.logger.info('Server stopped');
        resolve();
      });
    });
  }

  // Removed duplicate method implementations
}
