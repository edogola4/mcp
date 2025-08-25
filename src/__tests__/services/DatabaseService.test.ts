import { DatabaseService } from '../../services/DatabaseService';
import { open, Database } from 'sqlite';
import { BadRequestError } from '../../utils/errors';

// Mock the sqlite module
jest.mock('sqlite', () => {
  const mockDb = {
    run: jest.fn(),
    all: jest.fn(),
    close: jest.fn(),
    exec: jest.fn(),
    transaction: jest.fn(),
  };
  
  return {
    open: jest.fn().mockResolvedValue(mockDb),
    Database: jest.fn(),
  };
});

const mockConfig = {
  path: ':memory:',
  logging: false,
};

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  let mockDb: jest.Mocked<Database>;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create a new instance of DatabaseService for each test
    dbService = new DatabaseService(mockConfig);
    
    // Get the mock database instance
    const openMock = require('sqlite').open as jest.Mock;
    mockDb = await openMock();
  });

  describe('query', () => {
    it('should execute a read-only query successfully', async () => {
      const mockRows = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' },
      ];
      
      mockDb.all.mockResolvedValueOnce(mockRows);
      
      const result = await dbService.query({
        sql: 'SELECT * FROM test',
        readOnly: true,
      });
      
      expect(result).toEqual({
        rows: mockRows,
        fields: ['id', 'name'],
        rowCount: 2,
      });
      
      expect(mockDb.all).toHaveBeenCalledWith('SELECT * FROM test', []);
    });

    it('should execute a write query successfully', async () => {
      const mockResult = {
        lastID: 1,
        changes: 1,
      };
      
      mockDb.run.mockResolvedValueOnce(mockResult);
      
      const result = await dbService.query({
        sql: 'INSERT INTO test (name) VALUES (?)',
        params: ['Test'],
      });
      
      expect(result).toEqual({
        rows: [],
        rowCount: 0,
        lastID: 1,
        changes: 1,
      });
      
      expect(mockDb.run).toHaveBeenCalledWith('INSERT INTO test (name) VALUES (?)', ['Test']);
    });

    it('should throw BadRequestError for potentially dangerous SQL', async () => {
      const dangerousQueries = [
        'DROP TABLE users;',
        'SELECT * FROM users; DROP TABLE users;',
        'SELECT * FROM sqlite_master',
        'SELECT * FROM information_schema.tables',
      ];
      
      for (const query of dangerousQueries) {
        await expect(
          dbService.query({ sql: query })
        ).rejects.toThrow(BadRequestError);
      }
    });
  });

  describe('transaction', () => {
    it('should execute multiple queries in a transaction', async () => {
      const mockTx = {
        run: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
        all: jest.fn()
          .mockResolvedValueOnce([{ id: 1, name: 'Test' }])
          .mockResolvedValueOnce([{ id: 2, name: 'Another' }]),
      };
      
      mockDb.transaction.mockImplementation((callback) => callback(mockTx));
      
      const queries = [
        { sql: 'SELECT * FROM test WHERE id = ?', params: [1] },
        { sql: 'SELECT * FROM test WHERE name = ?', params: ['Another'] },
        { sql: 'UPDATE test SET name = ? WHERE id = ?', params: ['Updated', 1] },
      ];
      
      const results = await dbService.transaction(queries);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        rows: [{ id: 1, name: 'Test' }],
        fields: ['id', 'name'],
        rowCount: 1,
      });
      
      expect(results[1]).toEqual({
        rows: [{ id: 2, name: 'Another' }],
        fields: ['id', 'name'],
        rowCount: 1,
      });
      
      expect(results[2]).toEqual({
        rows: [],
        rowCount: 0,
        lastID: 1,
        changes: 1,
      });
      
      expect(mockTx.run).toHaveBeenCalledWith('UPDATE test SET name = ? WHERE id = ?', ['Updated', 1]);
      expect(mockTx.all).toHaveBeenCalledWith('SELECT * FROM test WHERE id = ?', [1]);
      expect(mockTx.all).toHaveBeenCalledWith('SELECT * FROM test WHERE name = ?', ['Another']);
    });

    it('should rollback transaction on error', async () => {
      const mockTx = {
        run: jest.fn(),
        all: jest.fn(),
        rollback: jest.fn(),
      };
      
      // Simulate an error in the second query
      mockDb.transaction.mockImplementation(async (callback) => {
        try {
          await callback(mockTx);
        } catch (error) {
          await mockTx.rollback();
          throw error;
        }
      });
      
      mockTx.all.mockRejectedValueOnce(new Error('Database error'));
      
      const queries = [
        { sql: 'SELECT * FROM test' },
        { sql: 'SELECT * FROM invalid_table' },
      ];
      
      await expect(dbService.transaction(queries)).rejects.toThrow('Database error');
      expect(mockTx.rollback).toHaveBeenCalled();
    });
  });

  describe('isReadOnlyQuery', () => {
    it('should correctly identify read-only queries', () => {
      const readOnlyQueries = [
        'SELECT * FROM test',
        'SELECT name, age FROM users WHERE age > ?',
        'PRAGMA table_info(users)',
        'EXPLAIN QUERY PLAN SELECT * FROM test',
        '  SELECT * FROM test  ', // With extra whitespace
      ];
      
      const writeQueries = [
        'INSERT INTO test (name) VALUES (?)',
        'UPDATE test SET name = ? WHERE id = ?',
        'DELETE FROM test',
        'CREATE TABLE test (id INTEGER PRIMARY KEY)',
        'ALTER TABLE test ADD COLUMN email TEXT',
        'DROP TABLE test',
        'REPLACE INTO test (id, name) VALUES (1, \'Test\')',
      ];
      
      // Test read-only queries
      for (const query of readOnlyQueries) {
        expect((dbService as any).isReadOnlyQuery(query)).toBe(true);
      }
      
      // Test write queries
      for (const query of writeQueries) {
        expect((dbService as any).isReadOnlyQuery(query)).toBe(false);
      }
    });
  });

  describe('close', () => {
    it('should close the database connection', async () => {
      await dbService.close();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle errors when closing the connection', async () => {
      const error = new Error('Failed to close connection');
      mockDb.close.mockRejectedValueOnce(error);
      
      await expect(dbService.close()).rejects.toThrow('Failed to close database connection');
    });
  });
});
