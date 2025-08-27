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
    this.app = express();
    this.rpcServer = new jayson.Server({}, {
      router: (method: string) => {
        // Return the method if it exists, otherwise return null
        return this.methods.has(method) ? this.methods.get(method) : null;
      }
    });
    
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

  private async handleRpcRequest(req: Request): Promise<any> {
    const { method, params, id } = req.body;
    
    if (!method) {
      return {
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Method is required' },
        id: id || null
      };
    }
    
    const rpcMethod = this.methods.get(method);
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
    this.app.post('/rpc', async (req: Request, res: Response) => {
      const requestId = Math.random().toString(36).substring(2, 9);
      const logContext = { 
        requestId,
        ip: req.ip, 
        userAgent: req.get('user-agent'),
        method: req.body?.method,
        path: '/rpc'
      };

      try {
        // Log the incoming request (without the full body to avoid logging sensitive data)
        this.logger.info('RPC request received', logContext);
        
        // Handle batch requests or single request
        const isBatch = Array.isArray(req.body);
        
        if (isBatch) {
          // Process batch requests in parallel
          const responses = await Promise.all(
            req.body.map((request: any) => 
              this.handleRpcRequest({ ...req, body: request })
            )
          );
          res.json(responses);
        } else {
          // Process single request
          const response = await this.handleRpcRequest(req);
          res.json(response);
        }
        
      } catch (error: any) {
        this.logger.error('Unhandled RPC error', { 
          ...logContext, 
          error: error.message, 
          stack: error.stack 
        });
        
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error processing request',
            data: process.env.NODE_ENV === 'development' ? error.message : undefined,
          },
          id: req.body?.id || null,
        });
      }
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
    this.logger.debug('Registering RPC method', { method: name });
    this.methods.set(name, async (params: any) => {
      try {
        const result = await method(params);
        return result;
      } catch (error: any) {
        this.logger.error(`RPC method ${name} error:`, error);
        // Create a plain object that matches the JSON-RPC error format
        const jsonRpcError = {
          code: error.code || -32603,
          message: error.message || 'Internal error',
          data: error.data || undefined
        };
        // Throw a plain error that will be caught by the JSON-RPC server
        const err = new Error(jsonRpcError.message);
        Object.assign(err, jsonRpcError);
        throw err;
      }
    });
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
