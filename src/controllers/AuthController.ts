import { Request, Response } from 'express';
import { AuthService } from '../services/auth/AuthService';
import { CreateUserInput, User } from '../models/User';

export class AuthController {
  constructor(private authService: AuthService) {}

  async register(req: Request, res: Response) {
    try {
      const { email, username, password, role } = req.body;
      
      if (!email || !username || !password) {
        return res.status(400).json({ message: 'Email, username, and password are required' });
      }

      const user = await this.authService.register({
        email,
        username,
        password,
        role
      });

      // Don't send password hash back to client
      const { passwordHash, ...userWithoutPassword } = user;
      
      res.status(201).json({
        message: 'User registered successfully',
        user: userWithoutPassword
      });
    } catch (error: any) {
      res.status(400).json({ 
        message: error.message || 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const { user, accessToken, refreshToken } = await this.authService.login(email, password);
      
      // Set HTTP-only cookie for refresh token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Return access token and user data
      res.json({
        message: 'Login successful',
        user,
        accessToken,
        expiresIn: 3600 // 1 hour in seconds
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({ 
        message: 'Invalid email or password',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required' });
      }

      const tokens = await this.authService.refreshToken(refreshToken);
      
      if (!tokens) {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
      }

      // Set new refresh token in HTTP-only cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        message: 'Token refreshed successfully',
        accessToken: tokens.accessToken,
        expiresIn: 3600 // 1 hour in seconds
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({ 
        message: 'Invalid refresh token',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      // Clear the refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      // Revoke the refresh token if user is authenticated
      if (req.user) {
        await this.authService.revokeToken(req.user.id);
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ 
        message: 'Error during logout',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const user = await this.authService.getUserById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Don't send password hash back to client
      const { passwordHash, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error in getProfile:', error);
      res.status(500).json({ 
        message: 'Error fetching user profile',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Add more controller methods for password reset, MFA setup, etc.
}
