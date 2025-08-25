import { MCPServer } from '../../core/Server';
import { DatabaseService } from '../../services/DatabaseService';
import { FileSystemService } from '../../services/FileSystemService';
import { WeatherService } from '../../services/WeatherService';
import { config } from '../../config';
import logger from '../../utils/logger';
import http from 'http';
import { AddressInfo } from 'net';

// Mock logger to avoid cluttering test output
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

// Mock services
jest.mock('../../services/DatabaseService');
jest.mock('../../services/FileSystemService');
jest.mock('../../services/WeatherService');

describe('MCPServer Integration', () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let serverAddress: string;
  let testConfig: typeof config;
  
  // Mock services
  const mockDbService = new DatabaseService({} as any);
  const mockFsService = new FileSystemService({} as any);
  const mockWeatherService = new WeatherService({} as any);
  
  beforeAll(async () => {
    // Create a test configuration with a random port
    testConfig = {
      ...config,
      server: {
        ...config.server,
        port: 0, // Let the OS assign a random port
      },
    };
    
    // Set up mock service responses
    (mockDbService.query as jest.Mock).mockResolvedValue({
      rows: [{ id: 1, name: 'test' }],
      rowCount: 1,
    });
    
    (mockFsService.readFile as jest.Mock).mockResolvedValue({
      content: 'test content',
      path: 'test.txt',
    });
    
    (mockFsService.writeFile as jest.Mock).mockResolvedValue({
      path: 'test.txt',
      size: 12,
    });
    
    (mockWeatherService.getCurrentWeather as jest.Mock).mockResolvedValue({
      location: { name: 'Test City', country: 'TC' },
      weather: {
        main: 'Clear',
        description: 'clear sky',
        temperature: { current: 25 },
      },
    });
    
    // Create and start the server
    server = new MCPServer(testConfig, logger as any);
    
    // Register mock services
    server.registerMethod('database.query', (params) => mockDbService.query(params));
    server.registerMethod('file.read', (params) => mockFsService.readFile(params));
    server.registerMethod('file.write', (params) => mockFsService.writeFile(params));
    server.registerMethod('weather.getCurrent', (params) => 
      mockWeatherService.getCurrentWeather(params)
    );
    
    // Start the server
    httpServer = (server as any).server;
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address() as AddressInfo;
        serverAddress = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });
  
  afterAll(async () => {
    // Stop the server
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });
  
  describe('JSON-RPC Endpoint', () => {
    it('should respond to a valid JSON-RPC request', async () => {
      const response = await fetch(`${serverAddress}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'weather.getCurrent',
          params: { city: 'Test City' },
          id: 1,
        }),
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('result');
      expect(data.result).toHaveProperty('location.name', 'Test City');
      expect(mockWeatherService.getCurrentWeather).toHaveBeenCalledWith({ city: 'Test City' });
    });
    
    it('should handle file read operations', async () => {
      const response = await fetch(`${serverAddress}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'file.read',
          params: { path: 'test.txt' },
          id: 2,
        }),
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('result');
      expect(data.result.content).toBe('test content');
      expect(mockFsService.readFile).toHaveBeenCalledWith({ path: 'test.txt' });
    });
    
    it('should handle database queries', async () => {
      const response = await fetch(`${serverAddress}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'database.query',
          params: { 
            sql: 'SELECT * FROM test',
            readOnly: true,
          },
          id: 3,
        }),
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('result');
      expect(data.result.rows).toHaveLength(1);
      expect(data.result.rows[0]).toEqual({ id: 1, name: 'test' });
      expect(mockDbService.query).toHaveBeenCalledWith({
        sql: 'SELECT * FROM test',
        readOnly: true,
      });
    });
    
    it('should return an error for invalid JSON-RPC requests', async () => {
      const response = await fetch(`${serverAddress}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
    
    it('should return an error for non-existent methods', async () => {
      const response = await fetch(`${serverAddress}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'nonexistent.method',
          params: {},
          id: 4,
        }),
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200); // JSON-RPC always returns 200, even for errors
      expect(data).toHaveProperty('error');
      expect(data.error.code).toBe(-32601); // Method not found
    });
  });
  
  describe('Health Check', () => {
    it('should respond to health check requests', async () => {
      const response = await fetch(`${serverAddress}/health`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Make the database query fail
      const error = new Error('Database connection failed');
      (mockDbService.query as jest.Mock).mockRejectedValueOnce(error);
      
      const response = await fetch(`${serverAddress}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'database.query',
          params: { 
            sql: 'SELECT * FROM error_table',
          },
          id: 5,
        }),
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200); // JSON-RPC always returns 200, even for errors
      expect(data).toHaveProperty('error');
      expect(data.error.message).toContain('Database connection failed');
    });
    
    it('should handle invalid JSON-RPC methods', async () => {
      const response = await fetch(`${serverAddress}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'invalid.method',
          params: {},
          id: 6,
        }),
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('error');
      expect(data.error.code).toBe(-32601); // Method not found
    });
  });
});
