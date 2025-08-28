import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../services/auth/AuthService';
import { UserRole } from '../../models/User';

export class AuthMiddleware {
  constructor(private authService: AuthService) {}

  authenticate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = this.authService.verifyToken(token);

        if (!decoded) {
          return res.status(401).json({ message: 'Invalid or expired token' });
        }

        // Add user to request object
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({ message: 'Authentication failed' });
      }
    };
  }

  authorize(roles: UserRole[] = []) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      next();
    };
  }

  // Middleware for MFA verification
  requireMFA() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      try {
        // Check if MFA is enabled for the user
        const user = await this.authService.getUserById(req.user.id);
        
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.mfaEnabled && !req.user.mfaVerified) {
          return res.status(403).json({ 
            message: 'MFA verification required',
            requiresMFA: true
          });
        }

        next();
      } catch (error) {
        console.error('Error in MFA verification:', error);
        res.status(500).json({ 
          message: 'Error during MFA verification',
          error: process.env.NODE_ENV === 'development' ? error : undefined
        });
      }
    };
  }
}
