import { v4 as uuidv4 } from 'uuid';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  roles: string[];
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  mfaVerified?: boolean; // Tracks if user has verified MFA setup
  mfaSecret?: string;    // Encrypted MFA secret
  backupCodes?: string[]; // Hashed backup codes
  lastLogin?: Date;
  refreshToken?: string;
  refreshTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any; // Allow additional properties
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  role?: UserRole;
  roles?: string[]; // Optional roles array
}

export interface UpdateUserInput {
  email?: string;
  username?: string;
  password?: string;
  role?: UserRole;
  roles?: string[];
  isEmailVerified?: boolean;
  mfaEnabled?: boolean;
  mfaVerified?: boolean;
  mfaSecret?: string | null;
  backupCodes?: string[] | null;
  lastLogin?: Date;
  refreshToken?: string | null;
  refreshTokenExpires?: Date | null;
}

export class UserModel {
  static createUser(input: CreateUserInput): User {
    const now = new Date();
    const role = input.role || UserRole.USER;
    const roles = [role.toLowerCase()];
    
    return {
      id: uuidv4(),
      email: input.email,
      username: input.username,
      passwordHash: '', // This should be hashed by the service
      role,
      roles,
      isEmailVerified: false,
      mfaEnabled: false,
      createdAt: now,
      updatedAt: now,
    } as User; // Type assertion to handle the index signature
  }
}
