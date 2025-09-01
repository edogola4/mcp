import { Request as ExpressRequest } from 'express';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        id: string;
        email: string;
        roles: string[];
      };
      session?: {
        state?: string;
        nonce?: string;
        tokenSet?: any;
        destroy: (callback: (err: any) => void) => void;
      };
    }
  }
}

export {};
