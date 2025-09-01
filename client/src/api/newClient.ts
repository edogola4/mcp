import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Declare global types for browser environment
declare global {
  interface Window {
    localStorage: Storage;
  }
}

const isBrowser = typeof window !== 'undefined';

export interface ApiErrorResponse {
  code: number;
  message: string;
  data?: any;
  status?: number;
}

export class ApiError extends Error {
  public readonly code: number;
  public readonly data?: any;
  public readonly status?: number;
  public readonly requestId?: string;

  constructor(
    message: string,
    { code = 0, data, status, requestId }: { code?: number; data?: any; status?: number; requestId?: string } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
    this.status = status;
    this.requestId = requestId;
  }

  static fromAxiosError(error: AxiosError, requestId?: string): ApiError {
    if (error.response) {
      const { status, data } = error.response;
      if (data && typeof data === 'object') {
        return new ApiError(data.message || error.message, {
          code: data.code || 0,
          data: data.data,
          status,
          requestId,
        });
      }
      return new ApiError(error.message, { status, requestId });
    }
    return new ApiError(error.message, { requestId });
  }
}

interface RPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

interface RPCResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

interface RequestConfigWithRetry extends AxiosRequestConfig {
  retry?: boolean;
}

export class ApiClient {
  private client: AxiosInstance;
  private refreshTokenPromise: Promise<string> | null = null;
  private requestId: string | null = null;

  constructor(baseURL: string = '') {
    const apiBaseUrl = import.meta.env.DEV 
      ? '/api' 
      : baseURL || (isBrowser ? window.location.origin : '');

    this.client = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': uuidv4(),
      },
      withCredentials: true,
      timeout: 30000, // 30 seconds
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if exists
        const token = this.getAuthToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as RequestConfigWithRetry & { _retry?: boolean };
        
        // If the error is 401 and we haven't tried to refresh the token yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const newToken = await this.refreshAuthToken();
            this.setAuthToken(newToken);
            
            // Retry the original request with the new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            // If refresh fails, clear auth and redirect to login
            this.clearAuth();
            if (isBrowser) {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    return isBrowser ? localStorage.getItem('authToken') : null;
  }

  private setAuthToken(token: string): void {
    if (isBrowser) {
      localStorage.setItem('authToken', token);
    }
  }

  private clearAuth(): void {
    if (isBrowser) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
    }
  }

  private async refreshAuthToken(): Promise<string> {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    const refreshToken = isBrowser ? localStorage.getItem('refreshToken') : null;
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    this.refreshTokenPromise = new Promise(async (resolve, reject) => {
      try {
        // Call your refresh token endpoint
        const response = await this.client.post<RPCResponse<RefreshTokenResponse>>(
          '/auth/refresh',
          { refreshToken }
        );

        if (response.data.error) {
          throw new Error(response.data.error.message);
        }

        const { accessToken, refreshToken: newRefreshToken } = response.data.result || {};
        
        if (!accessToken || !newRefreshToken) {
          throw new Error('Invalid token response');
        }

        // Store the new tokens
        this.setAuthToken(accessToken);
        if (isBrowser) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        resolve(accessToken);
      } catch (error) {
        this.clearAuth();
        reject(error);
      } finally {
        this.refreshTokenPromise = null;
      }
    });

    return this.refreshTokenPromise;
  }

  public async call<T = any>(
    method: string,
    params?: any,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    this.requestId = uuidv4();
    const requestConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...config.headers,
        'X-Request-ID': this.requestId,
      },
    };

    const request: RPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId,
    };

    try {
      const response = await this.client.post<RPCResponse<T>>(
        '/rpc',
        request,
        requestConfig
      );

      if (response.data.error) {
        throw new ApiError(response.data.error.message, {
          code: response.data.error.code,
          data: response.data.error.data,
          status: response.status,
          requestId: this.requestId,
        });
      }

      return response.data.result as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw ApiError.fromAxiosError(error, this.requestId || undefined);
      }
      throw error;
    }
  }
}

// Export a singleton instance
export const apiClient = new ApiClient(import.meta.env.VITE_API_BASE_URL);

export default apiClient;
