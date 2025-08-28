import { UserRole } from '../models/User';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: UserRole;
      mfaVerified?: boolean;
    }

    interface Request {
      user?: User;
    }
  }
}
