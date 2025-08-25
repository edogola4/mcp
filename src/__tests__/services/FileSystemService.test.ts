import fs from 'fs';
import path from 'path';
import { FileSystemService } from '../../services/FileSystemService';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';

// Mock the filesystem
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock promisified fs methods
const mockMkdir = jest.fn();
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockAccess = jest.fn();
const mockStat = jest.fn();

// Mock the promisified versions
jest.mock('util', () => ({
  promisify: (fn: any) => {
    if (fn === fs.mkdir) return mockMkdir;
    if (fn === fs.readFile) return mockReadFile;
    if (fn === fs.writeFile) return mockWriteFile;
    if (fn === fs.access) return mockAccess;
    if (fn === fs.stat) return mockStat;
    return jest.fn();
  },
}));

describe('FileSystemService', () => {
  const config = {
    sandboxDir: '/sandbox',
    maxFileSizeMB: 10,
  };
  
  let fileSystemService: FileSystemService;

  beforeEach(() => {
    jest.clearAllMocks();
    fileSystemService = new FileSystemService(config);
    
    // Default mock implementations
    mockAccess.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({
      isDirectory: () => false,
      size: 1024, // 1KB
    });
  });

  describe('readFile', () => {
    it('should read a file successfully', async () => {
      const filePath = 'test.txt';
      const fileContent = 'Hello, world!';
      
      mockReadFile.mockResolvedValue(fileContent);
      
      const result = await fileSystemService.readFile({ path: filePath });
      
      expect(result).toEqual({
        content: fileContent,
        path: filePath,
      });
      
      expect(mockAccess).toHaveBeenCalledWith(
        path.join(config.sandboxDir, filePath),
        fs.constants.R_OK
      );
      
      expect(mockReadFile).toHaveBeenCalledWith(
        path.join(config.sandboxDir, filePath),
        { encoding: 'utf-8' }
      );
    });

    it('should throw NotFoundError when file does not exist', async () => {
      const filePath = 'nonexistent.txt';
      
      mockAccess.mockRejectedValueOnce(new Error('File not found'));
      
      await expect(fileSystemService.readFile({ path: filePath })).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when path is a directory', async () => {
      const dirPath = 'test-dir';
      
      mockStat.mockResolvedValueOnce({
        isDirectory: () => true,
      });
      
      await expect(fileSystemService.readFile({ path: dirPath })).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when file exceeds size limit', async () => {
      const filePath = 'large-file.txt';
      
      mockStat.mockResolvedValueOnce({
        isDirectory: () => false,
        size: 11 * 1024 * 1024, // 11MB > 10MB limit
      });
      
      await expect(fileSystemService.readFile({ path: filePath })).rejects.toThrow(BadRequestError);
    });
  });

  describe('writeFile', () => {
    it('should write a new file successfully', async () => {
      const filePath = 'new-file.txt';
      const fileContent = 'New content';
      
      // File doesn't exist yet
      mockAccess.mockRejectedValueOnce(new Error('File not found'));
      
      // Mock successful write
      mockWriteFile.mockResolvedValue(undefined);
      
      // Mock stat for the new file
      mockStat.mockResolvedValueOnce({
        size: fileContent.length,
      });
      
      const result = await fileSystemService.writeFile({
        path: filePath,
        content: fileContent,
      });
      
      expect(result).toEqual({
        path: filePath,
        size: fileContent.length,
      });
      
      expect(mockMkdir).toHaveBeenCalledWith(
        path.dirname(path.join(config.sandboxDir, filePath)),
        { recursive: true }
      );
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(config.sandboxDir, filePath),
        fileContent,
        { encoding: 'utf-8', flag: 'w' }
      );
    });

    it('should append to an existing file when append=true', async () => {
      const filePath = 'existing.txt';
      const existingContent = 'Existing content';
      const newContent = 'New content';
      
      // Mock file exists
      mockAccess.mockResolvedValue(undefined);
      
      // Mock read for append
      mockReadFile.mockResolvedValue(existingContent);
      
      // Mock successful write
      mockWriteFile.mockResolvedValue(undefined);
      
      // Mock stat for the updated file
      mockStat.mockResolvedValueOnce({
        size: existingContent.length + newContent.length,
      });
      
      const result = await fileSystemService.writeFile({
        path: filePath,
        content: newContent,
        append: true,
      });
      
      expect(result).toEqual({
        path: filePath,
        size: existingContent.length + newContent.length,
      });
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(config.sandboxDir, filePath),
        existingContent + newContent,
        { encoding: 'utf-8', flag: 'w' }
      );
    });

    it('should throw BadRequestError when file exists and append=false', async () => {
      const filePath = 'existing.txt';
      
      // File exists
      mockAccess.mockResolvedValue(undefined);
      
      await expect(
        fileSystemService.writeFile({
          path: filePath,
          content: 'content',
          append: false,
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('resolvePath', () => {
    it('should resolve relative paths within sandbox', () => {
      const relativePath = 'subdir/file.txt';
      const result = (fileSystemService as any).resolvePath(relativePath);
      expect(result).toBe(path.join(config.sandboxDir, relativePath));
    });

    it('should prevent directory traversal attacks', () => {
      const maliciousPath = '../../etc/passwd';
      
      // Using any to access private method
      expect(() => (fileSystemService as any).resolvePath(maliciousPath)).toThrow(ForbiddenError);
    });

    it('should prevent absolute paths', () => {
      const absolutePath = '/etc/passwd';
      
      // Using any to access private method
      expect(() => (fileSystemService as any).resolvePath(absolutePath)).toThrow(BadRequestError);
    });
  });

  describe('validateParams', () => {
    it('should not throw for valid paths', () => {
      expect(() => (fileSystemService as any).validateParams({ path: 'valid/path.txt' })).not.toThrow();
    });

    it('should throw for empty path', () => {
      expect(() => (fileSystemService as any).validateParams({ path: '' })).toThrow(BadRequestError);
    });

    it('should throw for path with directory traversal', () => {
      expect(() => (fileSystemService as any).validateParams({ path: '../outside.txt' })).toThrow(BadRequestError);
    });
  });
});
