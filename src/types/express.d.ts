import { User as AppUser } from './User';

declare global {
  namespace Express {
    // Extend the base User type with our application-specific properties
    interface User extends AppUser {
      id: string;
      email: string;
      roles: string[];
      mfaVerified?: boolean;
    }

    // Extend the Request type with our application-specific properties
    interface Request {
      user?: User;
      mfaVerified?: boolean;
      hasRole?(role: string): boolean;
      hasAnyRole?(roles: string[]): boolean;
    }
  }
}
