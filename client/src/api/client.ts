import axios, { AxiosInstance } from 'axios';

export interface RPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

export interface RPCResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = '/api') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async call<T = any>(method: string, params?: any): Promise<T> {
    const request: RPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.generateId(),
    };

    try {
      const response = await this.client.post<RPCResponse<T>>('/rpc', request);
      
      // Handle JSON-RPC error response
      if (response.data.error) {
        const error = new Error(response.data.error.message);
        (error as any).code = response.data.error.code;
        (error as any).data = response.data.error.data;
        throw error;
      }
      
      // Return the result if no error
      if (response.data.result === undefined) {
        throw new Error('No result in response');
      }
      
      return response.data.result;
    } catch (error: any) {
      console.error('RPC call failed:', {
        method,
        params,
        error: error.message,
        code: error.code,
        data: error.data
      });
      throw error;
    }
  }

  // Helper methods for common operations
  async getHealth() {
    try {
      const response = await this.call<{ status: string; timestamp: string }>('health.check');
      return response || { status: 'error', timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'error', timestamp: new Date().toISOString() };
    }
  }

  async getWeather(location: string) {
    return this.call('weather.getCurrent', { location });
  }

  async listFiles(path: string = '/', recursive: boolean = false) {
    return this.call<any[]>('file.list', { path, recursive });
  }

  async readFile(path: string) {
    return this.call<string>('filesystem.readFile', { path });
  }

  async writeFile(path: string, content: string) {
    return this.call<void>('filesystem.writeFile', { path, content });
  }

  async queryDatabase(query: string, params: any[] = []) {
    return this.call<any[]>('database.query', { query, params });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

export const api = new ApiClient(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000');
