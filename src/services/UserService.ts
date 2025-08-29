import { Service } from 'typedi';
import { User, UserRole } from '../models/User';
import { AuthUser } from '../controllers/MFAController';
import * as crypto from 'crypto';
import { Logger } from 'winston';

export interface UpdateUserMFAOptions {
    mfaEnabled?: boolean;
    mfaSecret?: string;
    backupCodes?: string[];
    mfaVerified?: boolean;
}

@Service()
export class UserService {
    private users: User[] = []; // In-memory storage, replace with database in production
    private logger: Logger;

    constructor() {
        this.logger = (global as any).logger || console;
    }
    
    async getUserById(id: string): Promise<User | undefined> {
        return this.users.find(user => user.id === id);
    }
    
    async getUserByEmail(email: string): Promise<User | undefined> {
        return this.users.find(user => user.email === email);
    }
    
    async createUser(input: {
        email: string;
        username: string;
        passwordHash: string;
        role?: UserRole;
    }): Promise<User> {
        const now = new Date();
        const role = input.role || UserRole.USER;
        
        const user: User = {
            id: crypto.randomUUID(),
            email: input.email,
            username: input.username,
            passwordHash: input.passwordHash,
            role: role,
            roles: [role.toLowerCase()],
            isEmailVerified: false,
            mfaEnabled: false,
            mfaVerified: false,
            backupCodes: [],
            createdAt: now,
            updatedAt: now,
        };
        
        this.users.push(user);
        return user;
    }
    
    /**
     * Update MFA settings for a user
     * @param userId The ID of the user to update
     * @param options MFA options to update
     */
    async updateUserMFA(userId: string, options: UpdateUserMFAOptions): Promise<User | undefined> {
        try {
            const userIndex = this.users.findIndex(user => user.id === userId);
            if (userIndex === -1) {
                this.logger.warn(`User not found: ${userId}`);
                return undefined;
            }

            const updates: Partial<User> = {
                ...options,
                updatedAt: new Date(),
            };

            // Handle MFA disable case
            if (options.mfaEnabled === false) {
                updates.mfaSecret = undefined;
                updates.mfaVerified = false;
                updates.backupCodes = [];
            }

            // Apply updates
            const updatedUser = {
                ...this.users[userIndex],
                ...updates
            };

            this.users[userIndex] = updatedUser;
            this.logger.info(`Updated MFA settings for user: ${userId}`);
            return updatedUser;
        } catch (error) {
            this.logger.error(`Error updating MFA for user ${userId}:`, error);
            throw new Error('Failed to update MFA settings');
        }
    }

    /**
     * General user update method
     * @param id User ID
     * @param updates Partial user data to update
     */
    async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
        try {
            const userIndex = this.users.findIndex(user => user.id === id);
            if (userIndex === -1) {
                this.logger.warn(`User not found: ${id}`);
                return undefined;
            }

            // Preserve existing user data and apply updates
            const updatedUser = {
                ...this.users[userIndex],
                ...updates,
                updatedAt: new Date(),
            };
            
            this.users[userIndex] = updatedUser;
            this.logger.info(`Updated user: ${id}`);
            return updatedUser;
        } catch (error) {
            this.logger.error(`Error updating user ${id}:`, error);
            throw new Error('Failed to update user');
        }
    }
    
    async deleteUser(id: string): Promise<boolean> {
        const initialLength = this.users.length;
        this.users = this.users.filter(user => user.id !== id);
        return this.users.length < initialLength;
    }
    
    async listUsers(): Promise<User[]> {
        return [...this.users];
    }
}
