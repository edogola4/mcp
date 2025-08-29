import { Request, Response, NextFunction } from 'express';
import { MFAService } from '../services/MFAService';
import { Service, Container } from 'typedi';
import { UserService } from '../services/UserService';
import { User, UserRole } from '../models/User';
import { Logger } from 'winston';

// Define a consistent AuthUser type for the application
export interface AuthUser {
  id: string;
  email?: string;
  roles: string[];
  mfaEnabled?: boolean;
  [key: string]: any;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

@Service()
export class MFAController {
    private logger: Logger;

    constructor(
        private mfaService: MFAService,
        private userService: UserService
    ) {
        this.logger = (global as any).logger || console;
    }

    /**
     * Set up MFA for the authenticated user
     * Generates a new MFA secret and backup codes, then updates the user record
     * @param req Express request object
     * @param res Express response object
     */
    async setupMFA(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return res.status(401).json({ 
                    success: false,
                    error: 'Authentication required' 
                });
            }

            const userId = req.user.id;
            const user = await this.userService.getUserById(userId);
            
            if (!user) {
                return res.status(404).json({ 
                    success: false,
                    error: 'User not found' 
                });
            }

            if (user.mfaEnabled) {
                return res.status(400).json({ 
                    success: false,
                    error: 'MFA is already enabled for this account' 
                });
            }

            // Generate MFA secret and backup codes
            const { secret, qrCodeUrl, backupCodes, hashedBackupCodes } = 
                await this.mfaService.generateSecret(user.email || '');
            
            // Update user with MFA details using the dedicated MFA update method
            await this.userService.updateUserMFA(userId, {
                mfaEnabled: true,
                mfaSecret: secret,
                backupCodes: hashedBackupCodes,
                mfaVerified: false
            });

            // Return the QR code and one-time backup codes
            res.status(200).json({
                success: true,
                message: 'MFA setup successful',
                mfaEnabled: true,
                qrCodeUrl,
                backupCodes, // Show to user once, they should save these
                secret // For manual entry
            });
        } catch (error) {
            console.error('MFA Setup Error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to setup MFA' 
            });
        }
    }

    /**
     * Verify MFA token during setup
     * This endpoint is used to confirm that the user has successfully set up MFA
     * @param req Express request object
     * @param res Express response object
     */
    async verifyMFA(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return res.status(401).json({ 
                    success: false,
                    error: 'Authentication required' 
                });
            }

            const { token } = req.body;
            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: 'Token is required'
                });
            }

            const userId = req.user.id;
            const user = await this.userService.getUserById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            if (!user.mfaSecret) {
                return res.status(400).json({
                    success: false,
                    error: 'MFA not properly set up. Please set up MFA first.'
                });
            }

            // Verify the token is valid
            const isValid = this.mfaService.verifyToken(user.mfaSecret || '', token);
            
            if (!isValid) {
                this.logger.warn(`Invalid MFA token for user: ${userId}`);
                return res.status(400).json({ 
                    success: false,
                    error: 'Invalid MFA token' 
                });
            }
            
            // Mark MFA as verified for this user using the dedicated MFA update method
            const updatedUser = await this.userService.updateUserMFA(userId, { 
                mfaVerified: true 
            });
            
            if (!updatedUser) {
                this.logger.error(`Failed to update MFA verification status for user: ${userId}`);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update MFA verification status'
                });
            }

            res.status(200).json({ 
                success: true, 
                message: 'MFA verification successful',
                mfaEnabled: true
            });
        } catch (error) {
            console.error('MFA Verification Error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to verify MFA due to an internal error' 
            });
        }
    }

    /**
     * Verify MFA token during login
     * This endpoint is used to verify MFA tokens during the login process
     * @param req Express request object
     * @param res Express response object
     */
    async verifyLoginMFA(req: Request, res: Response): Promise<void> {
        try {
            const { userId, token, backupCode } = req.body;
            
            // Input validation
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
            }

            const user = await this.userService.getUserById(userId);

            // Check if user exists and MFA is enabled
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            if (!user.mfaEnabled) {
                return res.status(400).json({
                    success: false,
                    error: 'MFA is not enabled for this account'
                });
            }

            // Check if token is provided and valid
            if (token) {
                if (!user.mfaSecret) {
                    this.logger.warn(`MFA not set up for user: ${userId}`);
                    return res.status(400).json({
                        success: false,
                        error: 'MFA not properly set up for this account',
                        requiresMFA: true
                    });
                }
                
                const isValidToken = this.mfaService.verifyToken(user.mfaSecret, token);
                if (!isValidToken) {
                    this.logger.warn(`Invalid MFA token for user: ${userId}`);
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid MFA token',
                        requiresMFA: true
                    });
                }
            } 
            // Check backup code if no token is provided or if token verification failed
            else if (backupCode) {
                if (!user.backupCodes || user.backupCodes.length === 0) {
                    this.logger.warn(`No backup codes available for user: ${userId}`);
                    return res.status(400).json({
                        success: false,
                        error: 'No backup codes available for this account',
                        requiresMFA: true
                    });
                }
                
                const hashedBackupCode = this.mfaService.hashBackupCode(backupCode);
                const backupCodeIndex = user.backupCodes.indexOf(hashedBackupCode);
                
                if (backupCodeIndex === -1) {
                    this.logger.warn(`Invalid backup code for user: ${userId}`);
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid backup code',
                        requiresMFA: true
                    });
                }
                
                try {
                    // Remove the used backup code
                    const updatedBackupCodes = [...user.backupCodes];
                    updatedBackupCodes.splice(backupCodeIndex, 1);
                    
                    const updatedUser = await this.userService.updateUserMFA(userId, { 
                        backupCodes: updatedBackupCodes 
                    });
                    
                    if (!updatedUser) {
                        throw new Error('Failed to update backup codes');
                    }
                    
                    this.logger.info(`Used backup code for user: ${userId}, ${updatedBackupCodes.length} codes remaining`);
                } catch (error) {
                    this.logger.error(`Error updating backup codes for user ${userId}:`, error);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to process backup code',
                        requiresMFA: true
                    });
                }
            } 
            // Neither token nor backup code provided
            else {
                this.logger.warn(`Missing MFA credentials for user: ${userId}`);
                return res.status(400).json({
                    success: false,
                    error: 'Token is required when not using a backup code'
                });
            }

            if (!user.mfaSecret) {
                return res.status(500).json({
                    success: false,
                    error: 'MFA not properly configured. Please contact support.'
                });
            }

            const isValid = this.mfaService.verifyToken(user.mfaSecret, token);
            if (!isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired token. Please try again.'
                });
            }

            // Update last login time
            await this.userService.updateUser(userId, {
                lastLogin: new Date()
            });

            res.status(200).json({ 
                success: true, 
                message: 'MFA verification successful',
                mfaRequired: false
            });
        } catch (error) {
            console.error('MFA Login Verification Error:', error);
            res.status(500).json({ 
                success: false,
                error: 'An error occurred during MFA verification' 
            });
        }
    }
}
