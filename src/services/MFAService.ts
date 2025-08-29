import { authenticator, totp } from 'otplib';
import * as QRCode from 'qrcode';
import { Service } from 'typedi';
import * as crypto from 'crypto';
import { Logger } from 'winston';

// Set TOTP options
authenticator.options = {
  step: 30, // 30-second step
  window: 1  // Allow 1 step in either direction for clock skew
};

export interface MFASecretResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  hashedBackupCodes: string[];
}

@Service()
export class MFAService {
  private logger: Logger;

  constructor() {
    this.logger = (global as any).logger || console;
  }
    async generateSecret(email: string): Promise<MFASecretResponse> {
        try {
            const secret = authenticator.generateSecret();
            const otpauthUrl = authenticator.keyuri(email, 'MCP-Server', secret);
            const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
            
            // Generate backup codes
            const backupCodes = this.generateBackupCodes();
            const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));
            
            return { 
                secret, 
                qrCodeUrl,
                backupCodes,
                hashedBackupCodes
            };
        } catch (error) {
            this.logger.error('Error generating MFA secret:', error);
            throw new Error('Failed to generate MFA secret');
        }
    }

    verifyToken(secret: string, token: string): boolean {
        try {
            if (!secret || !token) {
                return false;
            }
            return authenticator.verify({ token, secret });
        } catch (error) {
            this.logger.error('Error verifying MFA token:', error);
            return false;
        }
    }

    generateBackupCodes(count = 5): string[] {
        try {
            return Array.from({ length: count }, () => 
                crypto.randomBytes(4).toString('hex').toUpperCase()
            );
        } catch (error) {
            this.logger.error('Error generating backup codes:', error);
            throw new Error('Failed to generate backup codes');
        }
    }

    hashBackupCode(code: string): string {
        try {
            if (!code) {
                throw new Error('Code cannot be empty');
            }
            return crypto.createHash('sha256').update(code).digest('hex');
        } catch (error) {
            this.logger.error('Error hashing backup code:', error);
            throw new Error('Failed to hash backup code');
        }
    }
}
