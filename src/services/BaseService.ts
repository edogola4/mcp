import { Logger } from 'winston';

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export abstract class BaseService {
  protected logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  protected success<T>(data: T): ServiceResponse<T> {
    return { success: true, data };
  }

  protected error<T = null>(code: string, message: string, details?: any): ServiceResponse<T> {
    return {
      success: false,
      error: { code, message, details }
    } as ServiceResponse<T>;
  }
}
