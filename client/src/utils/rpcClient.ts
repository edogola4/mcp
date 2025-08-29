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

class RPCClient {
  private client: AxiosInstance;
  private requestId: number = 0;

  constructor(baseURL: string = '') {
    // Use relative URL in development (handled by Vite proxy)
    // In production, use the provided base URL or fall back to current origin
    const apiBaseUrl = import.meta.env.DEV 
      ? '' 
      : baseURL || window.location.origin;

    this.client = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });
  }

  private generateId(): string {
    this.requestId += 1;
    return `rpc-${Date.now()}-${this.requestId}`;
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
      
      if (response.data.error) {
        const error = new Error(response.data.error.message);
        (error as any).code = response.data.error.code;
        (error as any).data = response.data.error.data;
        throw error;
      }

      return response.data.result as T;
    } catch (error: any) {
      if (error.response?.data?.error) {
        const rpcError = new Error(error.response.data.error.message);
        (rpcError as any).code = error.response.data.error.code;
        (rpcError as any).data = error.response.data.error.data;
        throw rpcError;
      }
      throw error;
    }
  }
}

// Create a singleton instance
export const rpcClient = new RPCClient(import.meta.env.VITE_API_BASE_URL || '/');

export default rpcClient;
