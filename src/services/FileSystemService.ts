import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { FileSystemConfig } from '../config';
import { MCPError, BadRequestError } from '../utils/errors';

// Promisified fs methods
const access = promisify(fs.access);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

// Type definitions
interface FileContent {
  content: string;
  path: string;
  size: number;
  lastModified: Date;
}

interface FileMetadata {
  path: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
}

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

interface FileReadParams {
  path: string;
  encoding?: BufferEncoding;
}

interface FileWriteParams extends FileReadParams {
  content: string;
  createDir?: boolean;
  append?: boolean;
}

export class FileSystemService {
  private config: FileSystemConfig;
  private sandboxDir: string;
  private maxFileSizeBytes: number;

  constructor(config: FileSystemConfig) {
    this.config = config;
    this.sandboxDir = path.resolve(process.cwd(), config.sandboxDir);
    this.maxFileSizeBytes = config.maxFileSizeMB * 1024 * 1024;
    
    // Ensure sandbox directory exists
    this.ensureDirectoryExists(this.sandboxDir).catch(err => {
      console.error('Failed to initialize sandbox directory:', err);
      process.exit(1);
    });
  }

  /**
   * Read a file from the sandboxed directory
   */
  public async readFile(params: FileReadParams): Promise<FileContent> {
    this.validatePath(params.path);
    const filePath = this.resolvePath(params.path);
    
    try {
      // Check if file exists and is accessible
      await access(filePath, fs.constants.R_OK);
      
      // Get file stats to check size
      const stats = await stat(filePath);
      
      // Check if it's a directory
      if (stats.isDirectory()) {
        throw new ForbiddenError('Cannot read directory');
      }
      
      // Read file content
      const content = await readFile(filePath, 'utf-8');
      
      return {
        content,
        path: params.path,
        size: Buffer.byteLength(content, 'utf-8'),
        lastModified: stats.mtime,
      };
    } catch (error: unknown) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        throw new NotFoundError(`File not found: ${params.path}`);
      }
      throw this.normalizeError(fsError, `Failed to read file: ${params.path}`);
    }
  }

  /**
   * Write content to a file in the sandboxed directory
   */
  public async writeFile(params: FileWriteParams): Promise<FileMetadata> {
    this.validatePath(params.path);
    
    try {
      await mkdir(path.dirname(params.path), { recursive: true });
      await writeFile(params.path, params.content, 'utf-8');
      
      const stats = await stat(params.path);
      
      return {
        path: params.path,
        size: stats.size,
        lastModified: stats.mtime,
        isDirectory: stats.isDirectory()
      };
    } catch (error: unknown) {
      throw this.normalizeError(error as Error, `Failed to write file: ${params.path}`);
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await access(dirPath, fs.constants.F_OK);
    } catch (error: unknown) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        await mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Resolve a relative path to an absolute path within the sandbox
   */
  private resolvePath(relativePath: string): string {
    // Prevent path traversal
    if (relativePath.includes('../') || relativePath === '..') {
      throw new ForbiddenError('Path traversal is not allowed');
    }

    // Prevent absolute paths by checking if the normalized path starts with a slash or drive letter
    const normalizedPath = path.normalize(relativePath).replace(/^(?:\/|\\)+/, '');
    
    // Check if the path is trying to traverse outside the sandbox
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      throw new ForbiddenError('Path traversal is not allowed');
    }
    const absolutePath = path.resolve(this.sandboxDir, normalizedPath);
    
    // Ensure the resolved path is within the sandbox
    if (!absolutePath.startsWith(this.sandboxDir)) {
      throw new ForbiddenError('Access to the requested path is not allowed');
    }
    
    return absolutePath;
  }

  /**
   * Validate file operation parameters
   */
  private validatePath(filePath: string): void {
    if (!filePath) {
      throw new BadRequestError('Path is required');
    }
    
    // Prevent path traversal
    if (filePath.includes('../') || filePath === '..') {
      throw new BadRequestError('Path traversal is not allowed');
    }
    
    // Prevent absolute paths
    if (path.isAbsolute(filePath)) {
      throw new BadRequestError('Absolute paths are not allowed');
    }
  }

  /**
   * Append content to an existing file
   */
  private async readFileForAppending(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, 'utf-8');
    } catch (error: unknown) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        return '';
      }
      throw new Error(`Failed to read file for appending: ${filePath}. ${fsError.message}`);
    }
  }

  /**
   * Format file size in a human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }

  /**
   * Normalize filesystem errors to MCP errors
   */
  private normalizeError(error: Error, message: string): Error {
    const nodeError = error as NodeJS.ErrnoException;
    
    if (nodeError.code) {
      const errorMessage = `${message}. ${nodeError.message}`;
      
      switch (nodeError.code) {
        case 'EACCES':
          return new Error(`Permission denied: ${errorMessage}`);
        case 'ENOENT':
          return new Error(`File not found: ${errorMessage}`);
        case 'EEXIST':
          return new Error(`File already exists: ${errorMessage}`);
        case 'ENOSPC':
          return new Error(`No space left on device: ${errorMessage}`);
        default:
          return new Error(`File system error: ${errorMessage}`);
      }
    }
    
    return error instanceof Error 
      ? error 
      : new Error(message);
  }
}
