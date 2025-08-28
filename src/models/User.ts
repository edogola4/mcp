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
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLogin?: Date;
  refreshToken?: string;
  refreshTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  username?: string;
  password?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  lastLogin?: Date;
}

export class UserModel {
  static createUser(input: CreateUserInput): User {
    const now = new Date();
    return {
      id: uuidv4(),
      email: input.email,
      username: input.username,
      passwordHash: '', // Will be hashed in the service
      role: input.role || UserRole.USER,
      isEmailVerified: false,
      mfaEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
  }
}
