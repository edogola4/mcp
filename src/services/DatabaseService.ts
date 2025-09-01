import sqlite3 from 'sqlite3';
import { open, Database as SQLiteDatabase } from 'sqlite';
import { DatabaseConfig } from '../config';
import { MCPError, BadRequestError } from '../utils/errors';
import { Logger } from 'winston';

type QueryParams = Record<string, any> | any[];

interface QueryResult<T = any> {
  rows: T[];
  fields?: string[];
  rowCount: number;
  lastID?: number;
  changes?: number;
}

export class DatabaseService {
  private config: DatabaseConfig;
  private dbPromise: Promise<SQLiteDatabase>;
  private isInitialized: boolean = false;
  private logger: Logger;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.dbPromise = this.initializeDatabase();
  }

  /**
   * Initialize the SQLite database
   */
  private async initializeDatabase(): Promise<SQLiteDatabase> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Ensure the directory exists
      const dbDir = path.dirname(this.config.path);
      try {
        await fs.mkdir(dbDir, { recursive: true });
      } catch (mkdirError: any) {
        if (mkdirError.code !== 'EEXIST') {
          throw mkdirError;
        }
      }
      
      const db = await open({
        filename: this.config.path,
        driver: sqlite3.Database,
      });

      // Enable foreign key constraints
      await db.run('PRAGMA foreign_keys = ON');
      
      // Set busy timeout to handle concurrent access
      await db.run('PRAGMA busy_timeout = 5000');
      
      // Set journal mode to WAL for better concurrency
      await db.run('PRAGMA journal_mode = WAL');
      
      this.isInitialized = true;
      return db;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during database initialization';
      throw new MCPError(
        'Failed to initialize database',
        500,
        'DATABASE_INIT_ERROR',
        { originalError: errorMessage }
      );
    }
  }

  /**
   * Get the database connection
   */
  private async getConnection(): Promise<SQLiteDatabase> {
    return this.dbPromise;
  }

  /**
   * Execute a SQL query with parameters
   */
  /**
   * Execute a SQL query with parameters
   */
  public async query<T = any>(params: {
    sql: string;
    values?: any[];
    readOnly?: boolean;
  }): Promise<QueryResult<T>> {
    return this.executeQuery<T>(params.sql, params.values || [], params.readOnly || false);
  }

  /**
   * Execute a SQL query with parameters (internal use)
   */
  private async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    readOnly: boolean = false
  ): Promise<QueryResult<T>> {
    const db = await this.getConnection();
    
    try {
      const startTime = Date.now();
      
      if (this.isReadOnlyQuery(query) && !readOnly) {
        throw new Error('Write operations are not allowed in read-only mode');
      }
      
      const result = await db.all(query, params);
      const duration = Date.now() - startTime;
      
      this.logger.debug(`Query executed in ${duration}ms`, {
        query,
        duration,
        rowCount: result.length,
        params,
      });
      
      return {
        rows: result,
        rowCount: result.length,
        fields: result.length > 0 ? Object.keys(result[0]) : [],
      };
    } catch (error: unknown) {
      const normalizedError = this.normalizeDatabaseError(error, query);
      this.logger.error('Database query failed', { 
        query, 
        params,
        error: normalizedError.message 
      });
      throw normalizedError;
    }
  }

  /**
   * Execute a transaction with multiple queries
   */
  public async transaction<T>(
    queries: Array<{ sql: string; params?: any[] }>
  ): Promise<QueryResult<T>[]> {
    const db = await this.getConnection();
    
    try {
      const results: QueryResult<T>[] = [];
      
      // Begin transaction
      await db.run('BEGIN TRANSACTION');
      
      try {
        for (const { sql, params = [] } of queries) {
          const result = await db.all(sql, params);
          results.push({
            rows: result,
            rowCount: result.length,
            fields: result.length > 0 ? Object.keys(result[0]) : [],
          });
        }
        
        // Commit transaction if all queries succeeded
        await db.run('COMMIT');
        return results;
      } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        throw error;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      this.logger.error('Transaction failed', { error: errorMessage });
      
      if (error instanceof Error) {
        throw this.normalizeDatabaseError(error, 'Transaction');
      }
      throw new Error('An unknown transaction error occurred');
    }
  }

  /**
   * Check if a SQL query is read-only
   */
  private isReadOnlyQuery(sql: string): boolean {
    if (!sql) return true;
    
    const normalized = sql.trim().toUpperCase();
    const readOnlyKeywords = ['SELECT', 'PRAGMA', 'EXPLAIN QUERY PLAN'];
    const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'REPLACE'];
    
    // Check for write keywords first (more critical to catch)
    if (writeKeywords.some(keyword => normalized.startsWith(keyword))) {
      return false;
    }
    
    // If no write keywords, check for read-only keywords
    return readOnlyKeywords.some(keyword => normalized.startsWith(keyword));
  }

  /**
   * Validate query parameters
   */
  private validateQueryParams(params: { sql: string; params?: any }): void {
    if (!params || typeof params !== 'object') {
      throw new BadRequestError('Invalid query parameters');
    }
    
    if (typeof params.sql !== 'string' || !params.sql.trim()) {
      throw new BadRequestError('SQL query must be a non-empty string');
    }
    
    // Basic SQL injection prevention (very basic, should be enhanced in production)
    const sql = params.sql.toLowerCase();
    const dangerousPatterns = [
      ';', // Multiple statements
      '--', '/*', '*/', // Comments
      'drop ', 'delete ', 'truncate ', 'update ', 'insert ', 'create ', 'alter ',
      'exec ', 'execute ', 'xp_', 'sp_', 'shutdown', 'grant ', 'revoke ',
      'union select', 'select * from', 'select * from information_schema',
      'select * from sqlite_master', 'select * from sqlite_temp_master'
    ];
    
    if (dangerousPatterns.some(pattern => sql.includes(pattern))) {
      throw new BadRequestError('Potentially dangerous SQL query detected');
    }
  }

  /**
   * Normalize database errors to MCP errors
   */
  private normalizeDatabaseError(error: unknown, query: string): Error {
    if (error instanceof MCPError || error instanceof BadRequestError) {
      return error;
    }
    
    const err = error as Error & { code?: string };
    const errorCode = err.code || 'UNKNOWN_ERROR';
    const errorMessage = err.message || 'Unknown database error';
    
    // Handle SQLITE_ERROR cases
    if (errorCode === 'SQLITE_ERROR') {
      if (errorMessage.includes('no such table')) {
        return new BadRequestError(
          'Table does not exist',
          { sql: query }
        );
      } else if (errorMessage.includes('no such column')) {
        return new BadRequestError(
          'Column does not exist',
          { sql: query }
        );
      } else if (errorMessage.includes('syntax error')) {
        return new BadRequestError(
          'Invalid SQL syntax',
          { sql: query }
        );
      } else if (errorMessage.includes('database is locked')) {
        return new MCPError(
          'Database is locked',
          423, // Locked
          'DATABASE_LOCKED',
          { sql: query }
        );
      } else {
        return new MCPError(
          'Database operation failed',
          500,
          'DATABASE_OPERATION_FAILED',
          { 
            sql: query,
            originalError: errorMessage
          }
        );
      }
    }
    
    // Handle other error codes
    if (errorCode === 'SQLITE_FULL' || errorCode === 'SQLITE_TOOBIG') {
      return new MCPError(
        'Database storage full',
        507, // Insufficient Storage
        'DATABASE_FULL',
        { sql: query }
      );
    }
    
    // Default error case
    return new MCPError(
      `Database error: ${errorMessage}`,
      500,
      'DATABASE_ERROR',
      { 
        originalError: errorMessage,
        sql: query
      }
    );
  }

  /**
   * Execute a SQL query with parameters (alias for query)
   */
  async execute<T = any>(
    sql: string, 
    params: any[] = [],
    readOnly: boolean = false
  ): Promise<QueryResult<T>> {
    return this.query<T>({ sql, values: params, readOnly });
  }

  /**
   * Get a single row from the database
   */
  async getOne<T = any>(
    sql: string, 
    params: any[] = []
  ): Promise<T | null> {
    const result = await this.query<T>({ 
      sql, 
      values: params,
      readOnly: true 
    });
    return result.rows[0] || null;
  }

  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.close();
      this.isInitialized = false;
      this.logger.info('Database connection closed');
    } catch (error) {
      this.logger.error('Error closing database connection:', error);
      throw this.normalizeDatabaseError(error, 'CLOSE_CONNECTION');
    }
  }
}
