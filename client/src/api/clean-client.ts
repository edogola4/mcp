import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
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
    { code = 0, data, status, requestId }: 
    { code?: number; data?: any; status?: number; requestId?: string } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
    this.status = status;
    this.requestId = requestId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  static fromAxiosError(error: AxiosError, requestId?: string): ApiError {
    if (error.response) {
      const { data, status } = error.response;
      const responseData = data as RPCResponse;
      
      if (responseData?.error) {
        return new ApiError(responseData.error.message, {
          code: responseData.error.code,
          data: responseData.error.data,
          status,
          requestId
        });
      }
      
      return new ApiError(`Request failed with status ${status}`, {
        code: status || 0,
        status,
        requestId
      });
    } else if (error.request) {
      return new ApiError('No response received from server', {
        code: 0,
        requestId
      });
    } else {
      return new ApiError(error.message || 'Error setting up request', {
        code: 0,
        requestId
      });
    }
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

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

export class ApiClient {
  private axios: AxiosInstance;
  private refreshTokenPromise: Promise<string> | null = null;
  private requestId: string | null = null;

  constructor(baseURL: string = '/api') {
    this.axios = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL || baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  private setupRequestInterceptor() {
    this.axios.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
        this.requestId = uuidv4();
        if (this.requestId) {
          config.headers = config.headers || {};
          config.headers['X-Request-ID'] = this.requestId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  private getAuthToken(): string | null {
    if (isBrowser) {
      return localStorage.getItem('authToken');
    }
    return null;
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

    this.refreshTokenPromise = (async (): Promise<string> => {
      try {
        const refreshToken = isBrowser ? localStorage.getItem('refreshToken') : null;
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await this.axios.request<RPCResponse<{
          accessToken: string;
          refreshToken: string;
        }>>({
          method: 'POST',
          url: '/auth/refresh',
          data: { refreshToken },
        });
        
        if (!response.data.result) {
          throw new Error('No result in refresh token response');
        }

        const { accessToken, refreshToken: newRefreshToken } = response.data.result;
        
        this.setAuthToken(accessToken);
        if (isBrowser && newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }
        
        return accessToken;
      } catch (error) {
        this.clearAuth();
        if (isBrowser) {
          window.location.href = '/login';
        }
        throw error;
      } finally {
        this.refreshTokenPromise = null;
      }
    })();

    return this.refreshTokenPromise;
  }

  private setupResponseInterceptor() {
    return this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status !== 401 || originalRequest._retry) {
          return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
          const newToken = await this.refreshAuthToken();
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return this.axios(originalRequest);
        } catch (refreshError) {
          this.clearAuth();
          if (isBrowser) {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
    );
  }

  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    retries = MAX_RETRIES,
    delay = RETRY_DELAY
  ): Promise<T> {
    try {
      const response = await this.axios.request<T>(config);
      return response.data;
    } catch (error) {
      if (retries <= 0 || !this.isRetryable(error)) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.requestWithRetry<T>(config, retries - 1, delay * 2);
    }
  }

  private isRetryable(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }
    
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return false;
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET') {
      return false;
    }

    return !error.response;
  }

  public async call<T = any>(
    method: string,
    params?: any,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    const request: RPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: uuidv4(),
    };

    try {
      const response = await this.axios.request<RPCResponse<T>>({
        ...config,
        method: 'POST',
        data: request,
      });

      if (response.data.error) {
        throw new ApiError(
          response.data.error.message,
          {
            code: response.data.error.code,
            data: response.data.error.data,
            status: response.status,
            requestId: this.requestId || undefined,
          }
        );
      }

      if (response.data.result === undefined) {
        throw new ApiError('No result in response', {
          code: -32603,
          status: response.status,
          requestId: this.requestId || undefined,
        });
      }

      return response.data.result as T;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof ApiError ? error.code : undefined;
      const errorData = error instanceof ApiError ? error.data : undefined;
      
      console.error('RPC call failed:', {
        method,
        params,
        error: errorMessage,
        code: errorCode,
        data: errorData,
        requestId: this.requestId
      });
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(errorMessage, {
        code: errorCode,
        data: errorData,
        requestId: this.requestId || undefined,
      });
    }
  }
}

// Create a singleton instance
const apiClient = new ApiClient(process.env.REACT_APP_API_BASE_URL);

export { apiClient };
export default apiClient;
