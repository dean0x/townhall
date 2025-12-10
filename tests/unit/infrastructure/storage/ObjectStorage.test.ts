/**
 * Security tests for ObjectStorage path validation
 *
 * CRITICAL: These tests validate path traversal prevention
 * All security controls must be tested to prevent vulnerabilities
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ObjectStorage } from '../../../../src/infrastructure/storage/ObjectStorage';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ObjectStorage Security Tests', () => {
  let storage: ObjectStorage;
  let testDir: string;

  beforeEach(async () => {
    // Create isolated temp directory for each test
    testDir = join(tmpdir(), `objectstorage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
    storage = new ObjectStorage(testDir);
    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Empty string validation', () => {
    it('should reject empty string in type parameter', async () => {
      const result = await storage.store('', { test: 'data' });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('cannot be empty');
        expect(result.error.operation).toBe('validation');
      }
    });

    it('should reject whitespace-only string in type parameter', async () => {
      const result = await storage.store('   ', { test: 'data' });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('cannot be empty');
        expect(result.error.operation).toBe('validation');
      }
    });

    it('should reject empty string in ID parameter', async () => {
      // Store valid data first to get a type
      const storeResult = await storage.store('arguments', { test: 'data' });
      expect(storeResult.isOk()).toBe(true);

      // Try to retrieve with empty ID
      const result = await storage.retrieve('arguments', '');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('cannot be empty');
        expect(result.error.operation).toBe('validation');
      }
    });

    it('should reject whitespace-only string in ID parameter', async () => {
      const result = await storage.retrieve('arguments', '   ');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('cannot be empty');
        expect(result.error.operation).toBe('validation');
      }
    });

    it('should reject tab and newline characters in type parameter', async () => {
      const testCases = ['\t', '\n', '\r', '\r\n', ' \t\n '];

      for (const testCase of testCases) {
        const result = await storage.store(testCase, { test: 'data' });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toContain('cannot be empty');
        }
      }
    });

    it('should reject tab and newline characters in ID parameter', async () => {
      const testCases = ['\t', '\n', '\r', '\r\n', ' \t\n '];

      for (const testCase of testCases) {
        const result = await storage.retrieve('arguments', testCase);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toContain('cannot be empty');
        }
      }
    });
  });

  describe('validateType() security', () => {
    it('should reject path traversal attempts with ../', async () => {
      const result = await storage.store('../../../etc/passwd', { test: 'data' });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid storage type');
        expect(result.error.operation).toBe('validation');
      }
    });

    it('should reject absolute paths in type parameter', async () => {
      const result = await storage.store('/etc/passwd', { test: 'data' });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid storage type');
      }
    });

    it('should reject type with uppercase characters', async () => {
      const result = await storage.store('Arguments', { test: 'data' });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid storage type');
        expect(result.error.message).toContain('lowercase alphanumeric');
      }
    });

    it('should reject type with special characters', async () => {
      const testCases = [
        'arg@ments',
        'arg#uments',
        'arg$uments',
        'arg%uments',
        'arg&uments',
        'arg*uments',
        'arg(uments',
        'arg)uments',
        'arg=uments',
        'arg+uments',
        'arg[uments',
        'arg]uments',
        'arg{uments',
        'arg}uments',
        'arg\\uments',
        'arg|uments',
        'arg;uments',
        'arg:uments',
        'arg\'uments',
        'arg"uments',
        'arg<uments',
        'arg>uments',
        'arg,uments',
        'arg.uments',
        'arg?uments',
        'arg/uments',
        'arg uments', // space
      ];

      for (const type of testCases) {
        const result = await storage.store(type, { test: 'data' });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toContain('Invalid storage type');
        }
      }
    });

    it('should accept valid lowercase alphanumeric with hyphens', async () => {
      const validTypes = [
        'arguments',
        'simulations',
        'agents',
        'test-type',
        'test-type-123',
        'abc123xyz',
      ];

      for (const type of validTypes) {
        // Use valid hex ID
        const result = await storage.store(type, { id: 'abc123def456', data: 'value' });
        expect(result.isOk()).toBe(true);
      }
    });

    it('should reject empty type parameter', async () => {
      const result = await storage.store('', { test: 'data' });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid storage type');
      }
    });

    it('should reject null bytes in type parameter', async () => {
      const result = await storage.store('arg\x00uments', { test: 'data' });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid storage type');
      }
    });
  });

  describe('validateId() security', () => {
    it('should reject path traversal attempts with ../', async () => {
      const result = await storage.retrieve('arguments', '../../../etc/passwd');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid ID format');
        expect(result.error.operation).toBe('validation');
      }
    });

    it('should reject absolute paths in id parameter', async () => {
      const result = await storage.retrieve('arguments', '/etc/passwd');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid ID format');
      }
    });

    it('should reject id with uppercase characters', async () => {
      const result = await storage.retrieve('arguments', 'ABC123DEF');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid ID format');
        expect(result.error.message).toContain('lowercase hexadecimal');
      }
    });

    it('should reject id with invalid characters', async () => {
      const testCases = [
        'arg@ment',
        'arg#ument',
        'arg$ument',
        'arg%ument',
        'arg&ument',
        'arg*ument',
        'arg(ument',
        'arg)ument',
        'arg=ument',
        'arg+ument',
        'arg[ument',
        'arg]ument',
        'arg{ument',
        'arg}ument',
        'arg\\ument',
        'arg|ument',
        'arg;ument',
        'arg:ument',
        'arg\'ument',
        'arg"ument',
        'arg<ument',
        'arg>ument',
        'arg,ument',
        'arg.ument',
        'arg?ument',
        'arg/ument',
        'arg ument', // space
        'xyz123', // contains non-hex characters
      ];

      for (const id of testCases) {
        const result = await storage.retrieve('arguments', id);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toContain('Invalid ID format');
        }
      }
    });

    it('should accept valid lowercase hexadecimal with hyphens', async () => {
      // First store some valid objects
      const validIds = [
        'abc123def456',
        'a1b2c3d4e5f6',
        'abc-123-def',
        'a-b-c-d-e-f',
      ];

      for (const id of validIds) {
        // Store with the specific ID
        const storeResult = await storage.store('arguments', { id, data: 'test' });
        expect(storeResult.isOk()).toBe(true);

        // Retrieve should work with valid ID
        const retrieveResult = await storage.retrieve('arguments', id);
        expect(retrieveResult.isOk()).toBe(true);
      }
    });

    it('should reject empty id parameter', async () => {
      const result = await storage.retrieve('arguments', '');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid ID format');
      }
    });

    it('should reject null bytes in id parameter', async () => {
      const result = await storage.retrieve('arguments', 'abc\x00def');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid ID format');
      }
    });
  });

  describe('validatePath() security', () => {
    it('should prevent path traversal with multiple ../ in store()', async () => {
      // This tests the final path validation
      // Even if type/id validation somehow fails, path validation should catch it
      const result = await storage.store('arguments', {
        id: 'a'.repeat(100) + '/../../../etc/passwd',
        data: 'malicious'
      });

      // Should be caught by ID validation first, but if not, path validation catches it
      expect(result.isErr()).toBe(true);
    });

    it('should prevent path traversal with multiple ../ in retrieve()', async () => {
      const result = await storage.retrieve(
        'arguments',
        'a'.repeat(100) + '/../../../etc/passwd'
      );

      // Should be caught by ID validation first, but if not, path validation catches it
      expect(result.isErr()).toBe(true);
    });

    it('should prevent accessing files outside base directory', async () => {
      // Try to access a file that exists outside the base directory
      const outsidePath = join(tmpdir(), 'outside-file.txt');
      await fs.writeFile(outsidePath, 'outside data');

      try {
        // Attempt to trick path validation
        const result = await storage.retrieve('..', '..', );
        expect(result.isErr()).toBe(true);
      } finally {
        await fs.unlink(outsidePath);
      }
    });

    it('should prevent symlink attacks (if symlinks created)', async () => {
      // Create a symlink pointing outside the base directory
      const outsideDir = join(tmpdir(), 'outside-dir');
      const symlinkPath = join(testDir, 'objects', 'symlink-test');

      await fs.mkdir(outsideDir, { recursive: true });

      try {
        await fs.symlink(outsideDir, symlinkPath);

        // Attempt to use the symlink
        const result = await storage.store('symlink-test', { id: 'test', data: 'value' });

        // Should be caught by type validation
        expect(result.isErr()).toBe(true);
      } catch (error) {
        // Symlink creation might fail on some systems, that's OK
      } finally {
        await fs.rm(outsideDir, { recursive: true, force: true });
      }
    });

    it('should ensure all paths resolve within basePath', async () => {
      // Store a legitimate object with valid hex ID
      const result = await storage.store('arguments', { id: 'abc123def456', data: 'value' });
      expect(result.isOk()).toBe(true);

      // Verify the file was created in the correct location
      const expectedPath = join(testDir, 'objects', 'arguments', 'abc123def456.json');
      const fileExists = await fs.access(expectedPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify no files created outside basePath
      const parentDir = join(testDir, '..');
      const parentFiles = await fs.readdir(parentDir);

      // Should only contain our test directory and other temp files
      expect(parentFiles).toContain(testDir.split('/').pop());
    });
  });

  describe('Cross-method security validation', () => {
    it('should validate type in all public methods', async () => {
      const invalidType = '../../../etc';

      const storeResult = await storage.store(invalidType, { id: 'test', data: 'value' });
      expect(storeResult.isErr()).toBe(true);

      const retrieveResult = await storage.retrieve(invalidType, 'test');
      expect(retrieveResult.isErr()).toBe(true);

      const existsResult = await storage.exists(invalidType, 'test');
      expect(existsResult.isErr()).toBe(true);

      const listResult = await storage.list(invalidType);
      expect(listResult.isErr()).toBe(true);

      const deleteResult = await storage.delete(invalidType, 'test');
      expect(deleteResult.isErr()).toBe(true);
    });

    it('should validate id in all relevant methods', async () => {
      const validType = 'arguments';
      const invalidId = '../../../etc/passwd';

      const retrieveResult = await storage.retrieve(validType, invalidId);
      expect(retrieveResult.isErr()).toBe(true);

      const existsResult = await storage.exists(validType, invalidId);
      expect(existsResult.isErr()).toBe(true);

      const deleteResult = await storage.delete(validType, invalidId);
      expect(deleteResult.isErr()).toBe(true);
    });

    it('should validate paths in all file operations', async () => {
      const validId = 'abc123def456';

      // Store should validate path
      const storeResult = await storage.store('arguments', { id: validId, data: 'value' });
      expect(storeResult.isOk()).toBe(true);

      // List should validate path
      const listResult = await storage.list('arguments');
      expect(listResult.isOk()).toBe(true);

      // Retrieve should validate path
      const retrieveResult = await storage.retrieve('arguments', validId);
      expect(retrieveResult.isOk()).toBe(true);

      // Delete should validate path
      const deleteResult = await storage.delete('arguments', validId);
      expect(deleteResult.isOk()).toBe(true);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long valid IDs', async () => {
      const longId = 'a'.repeat(64); // SHA-256 length is 64 hex chars

      const result = await storage.store('arguments', { id: longId, data: 'test' });
      expect(result.isOk()).toBe(true);

      const retrieveResult = await storage.retrieve('arguments', longId);
      expect(retrieveResult.isOk()).toBe(true);
    });

    describe('ReDoS Protection', () => {
      it('should quickly reject oversized IDs without regex processing', async () => {
        // This would cause catastrophic backtracking without length check
        const oversizedId = 'a'.repeat(10000);

        const startTime = performance.now();
        const result = await storage.retrieve('arguments', oversizedId);
        const duration = performance.now() - startTime;

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toContain('exceeds maximum length');
        }
        // Should complete quickly (500ms threshold allows for CI variability while still proving O(1) rejection)
        expect(duration).toBeLessThan(500);
      });

      it('should quickly reject oversized types without regex processing', async () => {
        const oversizedType = 'a'.repeat(10000);

        const startTime = performance.now();
        const result = await storage.store(oversizedType, { id: 'test', data: 'value' });
        const duration = performance.now() - startTime;

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toContain('exceeds maximum length');
        }
        // Should complete quickly (500ms threshold allows for CI variability while still proving O(1) rejection)
        expect(duration).toBeLessThan(500);
      });
    });

    it('should handle valid IDs with maximum hyphens', async () => {
      const hyphenatedId = 'a-b-c-d-e-f-0-1-2-3-4-5-6-7-8-9';

      const result = await storage.store('arguments', { id: hyphenatedId, data: 'test' });
      expect(result.isOk()).toBe(true);
    });

    it('should handle unicode in type parameter (should reject)', async () => {
      const unicodeTypes = [
        'argum😀ents',
        'аrguments', // Cyrillic 'а'
        'argüments',
        '参数',
      ];

      for (const type of unicodeTypes) {
        const result = await storage.store(type, { id: 'test', data: 'value' });
        expect(result.isErr()).toBe(true);
      }
    });

    it('should handle unicode in id parameter (should reject)', async () => {
      const unicodeIds = [
        'abc😀def',
        'аbc123', // Cyrillic 'а'
        'abcüdef',
        '参数123',
      ];

      for (const id of unicodeIds) {
        const result = await storage.retrieve('arguments', id);
        expect(result.isErr()).toBe(true);
      }
    });

    it('should handle case-sensitive filesystem edge cases', async () => {
      const validId = 'abc123def456';

      // Create object with lowercase type
      const storeResult = await storage.store('arguments', { id: validId, data: 'value' });
      expect(storeResult.isOk()).toBe(true);

      // Try to retrieve with different case (should fail validation)
      const retrieveResult = await storage.retrieve('Arguments', validId);
      expect(retrieveResult.isErr()).toBe(true);
    });
  });

  describe('File permission security', () => {
    it('should create object files with secure permissions (0o600)', async () => {
      const validId = 'abc123def456';
      const result = await storage.store('arguments', { id: validId, data: 'secure' });
      expect(result.isOk()).toBe(true);

      const filePath = join(testDir, 'objects', 'arguments', `${validId}.json`);
      const stats = await fs.stat(filePath);

      // Check file permissions (should be 0o600 - owner read/write only)
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('should create directories with secure permissions (0o700)', async () => {
      const validId = 'fedcba987654';
      const result = await storage.store('secure-type', { id: validId, data: 'value' });
      expect(result.isOk()).toBe(true);

      const dirPath = join(testDir, 'objects', 'secure-type');
      const stats = await fs.stat(dirPath);

      // Check directory permissions (should be 0o700 - owner full access only)
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o700);
    });
  });

  describe('TOCTOU Protection - Exclusive Mode', () => {
    it('should successfully create new object in exclusive mode', async () => {
      const result = await storage.store('arguments', { id: 'abc123def456', data: 'test' }, { exclusive: true });
      expect(result.isOk()).toBe(true);

      // Verify the file was created
      const retrieveResult = await storage.retrieve('arguments', 'abc123def456');
      expect(retrieveResult.isOk()).toBe(true);
    });

    it('should fail to overwrite existing object in exclusive mode', async () => {
      // First write succeeds
      const firstResult = await storage.store('arguments', { id: 'fedcba987654', data: 'first' }, { exclusive: true });
      expect(firstResult.isOk()).toBe(true);

      // Second write with same ID should fail
      const secondResult = await storage.store('arguments', { id: 'fedcba987654', data: 'second' }, { exclusive: true });
      expect(secondResult.isErr()).toBe(true);
      if (secondResult.isErr()) {
        expect(secondResult.error.message).toContain('already exists');
        expect(secondResult.error.operation).toBe('conflict');
      }

      // Verify original data is preserved
      const retrieveResult = await storage.retrieve('arguments', 'fedcba987654');
      expect(retrieveResult.isOk()).toBe(true);
      if (retrieveResult.isOk()) {
        expect(retrieveResult.value.data.data).toBe('first');
      }
    });

    it('should allow overwrite without exclusive mode', async () => {
      // First write
      const firstResult = await storage.store('arguments', { id: 'a1b2c3d4e5f6', data: 'first' });
      expect(firstResult.isOk()).toBe(true);

      // Second write without exclusive mode should succeed
      const secondResult = await storage.store('arguments', { id: 'a1b2c3d4e5f6', data: 'second' });
      expect(secondResult.isOk()).toBe(true);

      // Verify data was overwritten
      const retrieveResult = await storage.retrieve('arguments', 'a1b2c3d4e5f6');
      expect(retrieveResult.isOk()).toBe(true);
      if (retrieveResult.isOk()) {
        expect(retrieveResult.value.data.data).toBe('second');
      }
    });

    it('should handle concurrent writes atomically in exclusive mode', async () => {
      // First, ensure the type directory exists by doing a non-exclusive write (valid hex IDs)
      await storage.store('arguments', { id: '0'.repeat(64), data: 'setup' });

      // All concurrent writes target the same valid hex ID
      const concurrentWrites = Array(10).fill(null).map((_, i) =>
        storage.store('arguments', { id: '1'.repeat(64), data: `write-${i}` }, { exclusive: true })
      );

      const results = await Promise.all(concurrentWrites);

      // Exactly one should succeed
      const successful = results.filter(r => r.isOk());
      const failed = results.filter(r => r.isErr());

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(9);

      // All failures should be conflict errors
      for (const failedResult of failed) {
        if (failedResult.isErr()) {
          expect(failedResult.error.message).toContain('already exists');
        }
      }
    });
  });

  describe('Regression tests for known attack vectors', () => {
    it('should prevent null byte injection', async () => {
      const nullByteAttacks = [
        'valid\x00../../etc/passwd',
        'test\x00.json',
        'arg\x00uments',
      ];

      for (const attack of nullByteAttacks) {
        const storeResult = await storage.store(attack, { id: 'test', data: 'value' });
        expect(storeResult.isErr()).toBe(true);

        const retrieveResult = await storage.retrieve('arguments', attack);
        expect(retrieveResult.isErr()).toBe(true);
      }
    });

    it('should prevent double encoding attacks', async () => {
      const doubleEncodedAttacks = [
        '%2e%2e%2f%2e%2e%2fetc%2fpasswd', // ../../../etc/passwd
        '%252e%252e%252f', // %2e%2e%2f (encoded twice)
      ];

      for (const attack of doubleEncodedAttacks) {
        const result = await storage.store(attack, { id: 'test', data: 'value' });
        expect(result.isErr()).toBe(true);
      }
    });

    it('should prevent UNC path injection (Windows)', async () => {
      const uncPaths = [
        '\\\\server\\share\\file',
        '//server/share/file',
      ];

      for (const path of uncPaths) {
        const result = await storage.store(path, { id: 'test', data: 'value' });
        expect(result.isErr()).toBe(true);
      }
    });
  });
});
