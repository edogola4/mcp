import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { API_CONFIG } from '../config';

// Simple interface for API responses
interface RPCResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number | null;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface QueuedRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

export class ApiClient {
  private readonly client: AxiosInstance;
  private readonly baseURL: string;
  private isRefreshing = false;
  private failedQueue: QueuedRequest[] = [];
  private refreshTokenPromise: Promise<string> | null = null;

  constructor(baseURL = '') {
    this.baseURL = baseURL || (typeof window !== 'undefined' ? window.location.origin : '');
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      timeout: 30000, // 30 seconds
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for handling 401 errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return this.client(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshToken();
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              this.processQueue(null, newToken);
              return this.client(originalRequest);
            }
          } catch (error) {
            this.processQueue(error);
            this.clearAuth();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return Promise.reject(error);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: unknown, token: string | null = null): void {
    this.failedQueue.forEach((promise) => {
      if (error) {
        promise.reject(error);
      } else {
        promise.resolve(token);
      }
    });
    this.failedQueue = [];
  }

  private async refreshToken(): Promise<string> {
    // Return the existing promise if a refresh is already in progress
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearAuth();
      throw new Error('No refresh token available');
    }

    this.refreshTokenPromise = (async (): Promise<string> => {
      try {
        const response = await axios.post<RPCResponse<AuthTokens>>(
          `${this.baseURL}/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );

        if (!response.data?.result) {
          throw new Error('Invalid refresh token response');
        }

        const { accessToken, refreshToken: newRefreshToken } = response.data.result;
        this.setAuthToken(accessToken);
        if (newRefreshToken) {
          this.setRefreshToken(newRefreshToken);
        }
        return accessToken;
      } catch (error) {
        this.clearAuth();
        throw error;
      } finally {
        this.refreshTokenPromise = null;
      }
    })();

    return this.refreshTokenPromise;
  }

  // Simple auth token management
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('authToken');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  private setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  private setRefreshToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('refreshToken', token);
    }
  }

  public clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
    }
  }

  // Main API call method
  public async call<T = unknown>(
    method: string, 
    params?: unknown,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    const request = {
      jsonrpc: '2.0' as const,
      method,
      params,
      id: uuidv4(),
    };

    try {
      const response = await this.client.request<RPCResponse<T>>({
        ...config,
        method: 'POST',
        url: config.url || '',
        data: request,
      });
      
      if (!response.data) {
        throw new Error('No response data received');
      }

      if (response.data.error) {
        const error = new Error(response.data.error.message) as Error & { code?: number; data?: unknown };
        error.code = response.data.error.code;
        error.data = response.data.error.data;
        throw error;
      }

      if (response.data.result === undefined) {
        throw new Error('No result in response');
      }

      return response.data.result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`API call failed (${method}):`, errorMessage);
      
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Status:', error.response?.status);
      }
      
      throw error;
    }
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient(API_CONFIG.BASE_URL);

export default apiClient;
