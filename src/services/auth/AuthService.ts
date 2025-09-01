import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../DatabaseService';
import { User, UserRole, CreateUserInput, UpdateUserInput } from '../../models/User';
import { Logger } from 'winston';

export class AuthService {
  private db: DatabaseService;
  private logger: Logger;
  private readonly jwtSecret: string;
  private readonly tokenExpiry: string;
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiry: string;

  constructor(db: DatabaseService, logger: Logger) {
    this.db = db;
    this.logger = logger;
    
    // Load JWT configuration from environment variables
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-key';
    this.tokenExpiry = process.env.JWT_EXPIRY || '1h';
    this.refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-token-secret';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    
    if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
      logger.warn('Using default JWT secrets. For production, set JWT_SECRET and REFRESH_TOKEN_SECRET in your environment variables.');
    }
    
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    await this.db.query({
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL,
          is_email_verified INTEGER DEFAULT 0,
          mfa_enabled INTEGER DEFAULT 0,
          mfa_secret TEXT,
          last_login DATETIME,
          refresh_token TEXT,
          refresh_token_expires DATETIME,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL
        )
      `,
      readOnly: false
    });
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  private async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async register(userData: CreateUserInput): Promise<User> {
    const { email, username, password, role } = userData;
    
    // Check if user already exists
    const existingUser = await this.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(userData.password);
    
    // Create user object with roles
    const user: User = {
      id: uuidv4(),
      email: userData.email,
      username: userData.username,
      passwordHash: hashedPassword,
      role: userData.role || UserRole.USER,
      roles: userData.roles || [userData.role || UserRole.USER], // Ensure roles array is set
      isEmailVerified: false,
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.execute(
      `INSERT INTO users (
        id, email, username, password_hash, role, 
        is_email_verified, mfa_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.email,
        user.username,
        user.passwordHash,
        user.role,
        user.isEmailVerified ? 1 : 0,
        user.mfaEnabled ? 1 : 0,
        user.createdAt.toISOString(),
        user.updatedAt.toISOString(),
      ]
    );

    return user;
  }

  async login(email: string, password: string): Promise<{ 
    user: Omit<User, 'passwordHash'>; 
    accessToken: string; 
    refreshToken: string 
  }> {
    const user = await this.getUserByEmail(email);
    
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new Error('Invalid email or password');
    }
    
    const now = new Date();
    const refreshToken = await this.generateAndSaveRefreshToken(user.id);
    const accessToken = this.generateAccessToken(user);
    
    // Update last login time and save refresh token
    await this.db.execute(
      `UPDATE users 
       SET last_login = ?, 
           refresh_token = ?,
           refresh_token_expires = ?,
           updated_at = ? 
       WHERE id = ?`,
      [
        now.toISOString(),
        refreshToken,
        this.calculateTokenExpiry(this.refreshTokenExpiry).toISOString(),
        now.toISOString(),
        user.id
      ]
    );
    
    // Don't send password hash back to client
    const { passwordHash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken
    };
  }

  private generateAccessToken(user: User): string {
    const payload = { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      roles: user.roles || [user.role], // Include roles in the token
      tokenType: 'access' as const
    };
    
    // Use a type assertion to handle the expiresIn type
    const options = { 
      expiresIn: this.tokenExpiry,
      algorithm: 'HS256' as const
    } as jwt.SignOptions;
    
    return jwt.sign(payload, this.jwtSecret, options);
  }

  private async generateAndSaveRefreshToken(userId: string): Promise<string> {
    const payload = { 
      userId, 
      tokenType: 'refresh' as const 
    };
    
    // Use a type assertion to handle the expiresIn type
    const options = {
      expiresIn: this.refreshTokenExpiry,
      algorithm: 'HS256' as const
    } as jwt.SignOptions;
    
    return jwt.sign(payload, this.refreshTokenSecret, options);
  }
  
  private calculateTokenExpiry(expiryString: string): Date {
    const expiry = this.parseTimeToSeconds(expiryString);
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + expiry);
    return expiryDate;
  }

  verifyToken(token: string, isRefreshToken = false): any {
    try {
      return jwt.verify(token, isRefreshToken ? this.refreshTokenSecret : this.jwtSecret, {
        issuer: 'mcp-server',
        audience: isRefreshToken ? undefined : ['mcp-client']
      });
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret) as { 
        userId: string; 
        tokenType: string;
        iat: number;
        exp: number;
      };
      
      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Get user and verify the stored refresh token matches
      const user = await this.getUserById(decoded.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Check if refresh token matches and is not expired
      if (user.refreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      if (user.refreshTokenExpires && new Date(user.refreshTokenExpires) < new Date()) {
        throw new Error('Refresh token has expired');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = await this.generateAndSaveRefreshToken(user.id);

      // Update the refresh token in the database
      await this.db.execute(
        `UPDATE users 
         SET refresh_token = ?, 
             refresh_token_expires = ?, 
             updated_at = ? 
         WHERE id = ?`,
        [
          newRefreshToken,
          this.calculateTokenExpiry(this.refreshTokenExpiry).toISOString(),
          new Date().toISOString(),
          user.id
        ]
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      this.logger.error('Error refreshing token:', error);
      return null;
    }
  }

  async revokeToken(userId: string): Promise<boolean> {
    try {
      await this.db.execute(
        'UPDATE users SET refresh_token = NULL, refresh_token_expires = NULL, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), userId]
      );
      return true;
    } catch (error) {
      this.logger.error('Error revoking token:', error);
      return false;
    }
  }

  private parseTimeToSeconds(timeString: string): number {
    const timeValue = parseInt(timeString);
    if (timeString.endsWith('d')) return timeValue * 24 * 60 * 60; // days
    if (timeString.endsWith('h')) return timeValue * 60 * 60; // hours
    if (timeString.endsWith('m')) return timeValue * 60; // minutes
    return timeValue; // seconds
  }

  // Add methods for MFA, password reset, etc. as needed

  async getUserById(userId: string): Promise<(User & { refreshToken?: string; refreshTokenExpires?: Date }) | null> {
    try {
      const user = await this.db.getOne<{
        id: string;
        email: string;
        username: string;
        password_hash: string;
        role: string;
        is_email_verified: number;
        mfa_enabled: number;
        mfa_secret?: string;
        last_login?: string;
        refresh_token?: string;
        refresh_token_expires?: string;
        created_at: string;
        updated_at: string;
      }>(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!user) return null;

      // Map database fields to User interface
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash: user.password_hash,
        role: user.role as UserRole,
        roles: [user.role as UserRole], // Default to role as single-item array
        isEmailVerified: Boolean(user.is_email_verified),
        mfaEnabled: Boolean(user.mfa_enabled),
        mfaSecret: user.mfa_secret,
        lastLogin: user.last_login ? new Date(user.last_login) : undefined,
        refreshToken: user.refresh_token,
        refreshTokenExpires: user.refresh_token_expires ? new Date(user.refresh_token_expires) : undefined,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      };
    } catch (error) {
      this.logger.error('Error fetching user by ID:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<(User & { refreshToken?: string; refreshTokenExpires?: Date }) | null> {
    try {
      const user = await this.db.getOne<{
        id: string;
        email: string;
        username: string;
        password_hash: string;
        role: string;
        is_email_verified: number;
        mfa_enabled: number;
        mfa_secret?: string;
        last_login?: string;
        refresh_token?: string;
        refresh_token_expires?: string;
        created_at: string;
        updated_at: string;
      }>(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (!user) return null;

      // Map database fields to User interface
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash: user.password_hash,
        role: user.role as UserRole,
        roles: [user.role as UserRole], // Default to role as single-item array
        isEmailVerified: Boolean(user.is_email_verified),
        mfaEnabled: Boolean(user.mfa_enabled),
        mfaSecret: user.mfa_secret,
        lastLogin: user.last_login ? new Date(user.last_login) : undefined,
        refreshToken: user.refresh_token,
        refreshTokenExpires: user.refresh_token_expires ? new Date(user.refresh_token_expires) : undefined,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      };
    } catch (error) {
      this.logger.error('Error fetching user by email:', error);
      return null;
    }
  }

  // Add more authentication methods as needed
}
