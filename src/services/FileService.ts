import fs from 'fs/promises';
import path from 'path';
import { Logger } from 'winston';
import { BaseService, ServiceResponse } from './BaseService';

export interface FileContent {
  path: string;
  content: string | Buffer;
  size: number;
  type: 'file' | 'directory';
  mtime?: Date;
  ctime?: Date;
}

export interface ReadFileOptions {
  encoding?: BufferEncoding;
  flag?: string;
}

export interface WriteFileOptions {
  encoding?: BufferEncoding;
  mode?: string | number;
  flag?: string;
  createParentDirs?: boolean;
}

export class FileService extends BaseService {
  private baseDir: string;

  constructor(logger: Logger, baseDir: string = process.cwd()) {
    super(logger);
    this.baseDir = path.normalize(baseDir);
  }

  /**
   * Get absolute path, ensuring it's within the base directory
   */
  private getAbsolutePath(filePath: string): string {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.baseDir, filePath);
    
    // Security: Prevent directory traversal
    if (!absolutePath.startsWith(this.baseDir)) {
      throw new Error('Access to requested path is denied');
    }
    
    return absolutePath;
  }

  /**
   * Ensure parent directories exist
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Read file content
   */
  public async readFile(
    filePath: string, 
    options: ReadFileOptions = { encoding: 'utf8' }
  ): Promise<ServiceResponse<FileContent>> {
    const absolutePath = this.getAbsolutePath(filePath);
    
    try {
      const stats = await fs.stat(absolutePath);
      
      if (stats.isDirectory()) {
        return this.error<FileContent>('IS_DIRECTORY', 'Path is a directory, not a file');
      }
      
      const content = await fs.readFile(absolutePath, options);
      
      return this.success({
        path: absolutePath,
        content,
        size: stats.size,
        type: 'file',
        mtime: stats.mtime,
        ctime: stats.ctime
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return this.error<FileContent>('FILE_NOT_FOUND', `File not found: ${absolutePath}`);
      }
      this.logger.error('Error reading file', { error, path: absolutePath });
      return this.error<FileContent>('READ_ERROR', `Failed to read file: ${error.message}`);
    }
  }

  /**
   * Write content to a file
   */
  public async writeFile(
    filePath: string, 
    content: string | Buffer, 
    options: WriteFileOptions = { encoding: 'utf8', createParentDirs: true }
  ): Promise<ServiceResponse<FileContent>> {
    const absolutePath = this.getAbsolutePath(filePath);
    
    try {
      if (options.createParentDirs) {
        const dirPath = path.dirname(absolutePath);
        await this.ensureDirectory(dirPath);
      }
      
      await fs.writeFile(
        absolutePath, 
        content, 
        { 
          encoding: options.encoding,
          mode: options.mode,
          flag: options.flag 
        }
      );
      
      const stats = await fs.stat(absolutePath);
      
      return this.success({
        path: absolutePath,
        content,
        size: Buffer.byteLength(content),
        type: 'file',
        mtime: stats.mtime,
        ctime: stats.ctime
      });
    } catch (error: any) {
      this.logger.error('Error writing file', { 
        error, 
        path: absolutePath,
        contentLength: Buffer.byteLength(content)
      });
      return this.error('WRITE_ERROR', `Failed to write file: ${error.message}`);
    }
  }

  /**
   * List directory contents
   */
  public async readDirectory(dirPath: string): Promise<ServiceResponse<FileContent[]>> {
    const absolutePath = this.getAbsolutePath(dirPath);
    
    try {
      const stats = await fs.stat(absolutePath);
      
      if (!stats.isDirectory()) {
        return this.error<FileContent[]>('NOT_A_DIRECTORY', 'Path is not a directory');
      }
      
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const results: FileContent[] = [];
      
      for (const entry of entries) {
        try {
          const entryPath = path.join(absolutePath, entry.name);
          const entryStats = await fs.stat(entryPath);
          
          results.push({
            path: entryPath,
            content: '',
            size: entryStats.size,
            type: entry.isDirectory() ? 'directory' : 'file',
            mtime: entryStats.mtime,
            ctime: entryStats.ctime
          });
        } catch (error) {
          this.logger.warn('Error reading directory entry', { 
            error, 
            path: absolutePath,
            entry: entry.name 
          });
        }
      }
      
      return this.success(results);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return this.error<FileContent[]>('DIRECTORY_NOT_FOUND', `Directory not found: ${absolutePath}`);
      }
      this.logger.error('Error reading directory', { error, path: absolutePath });
      return this.error<FileContent[]>('READ_ERROR', `Failed to read directory: ${error.message}`);
    }
  }

  /**
   * Check if a file or directory exists
   */
  public async exists(path: string): Promise<boolean> {
    try {
      await fs.access(this.getAbsolutePath(path));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file or directory
   */
  public async delete(path: string, recursive: boolean = false): Promise<ServiceResponse<{ deleted: boolean }>> {
    const absolutePath = this.getAbsolutePath(path);
    
    try {
      const stats = await fs.stat(absolutePath);
      
      if (stats.isDirectory()) {
        if (!recursive) {
          const entries = await fs.readdir(absolutePath);
          if (entries.length > 0) {
            return this.error<{ deleted: boolean }>('DIRECTORY_NOT_EMPTY', 'Directory is not empty. Use recursive=true to delete non-empty directories');
          }
        }
        try {
          await fs.rm(absolutePath, { recursive: true, force: true });
        } catch (error: any) {
          this.logger.error('Error deleting directory', { error, path: absolutePath });
          return this.error<{ deleted: boolean }>('DELETE_ERROR', `Failed to delete directory: ${error.message}`);
        }
      } else {
        try {
          await fs.unlink(absolutePath);
        } catch (error: any) {
          this.logger.error('Error deleting file', { error, path: absolutePath });
          return this.error<{ deleted: boolean }>('DELETE_ERROR', `Failed to delete file: ${error.message}`);
        }
      }
      
      return this.success({ deleted: true });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return this.error<{ deleted: boolean }>('NOT_FOUND', 'File or directory not found');
      }
      this.logger.error('Error deleting file or directory', { error, path: absolutePath });
      return this.error<{ deleted: boolean }>('DELETE_ERROR', `Failed to delete: ${error.message}`);
    }
  }
}
