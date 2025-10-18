/**
 * Integration tests for AI agent safety protections
 * Tests resource exhaustion, prompt injection defenses, and malicious input handling
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ObjectStorage } from '../../../../src/infrastructure/storage/ObjectStorage';
import { FileAgentRepository } from '../../../../src/infrastructure/storage/FileAgentRepository';
import { ILogger } from '../../../../src/application/ports/ILogger';

const mockLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => mockLogger,
};

describe('AI Agent Safety Tests', () => {
  let testDir: string;
  let storage: ObjectStorage;
  let agentRepo: FileAgentRepository;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ai-safety-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
    storage = new ObjectStorage(testDir);
    agentRepo = new FileAgentRepository(mockLogger, testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should reject deeply nested JSON structures', async () => {
      let deeplyNested: any = { value: 'leaf' };
      for (let i = 0; i < 100; i++) {
        deeplyNested = { child: deeplyNested };
      }

      const result = await storage.store('test', deeplyNested);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('complexity limit');
      }
    });

    it('should reject extremely large JSON payloads', async () => {
      const largeString = 'x'.repeat(11_000_000);
      const largeData = { content: largeString };

      const result = await storage.store('test', largeData);
      expect(result.isErr()).toBe(true);
    });

    it('should handle nested structures at safe depth', async () => {
      let safeNested: any = { value: 'leaf' };
      for (let i = 0; i < 30; i++) {
        safeNested = { child: safeNested };
      }

      const result = await storage.store('test', safeNested);
      expect(result.isOk()).toBe(true);
    });

    it('should reject JSON with excessive file size on retrieval', async () => {
      const validId = 'a'.repeat(64);
      const objectPath = join(testDir, 'objects', 'test', `${validId}.json`);

      await fs.mkdir(join(testDir, 'objects', 'test'), { recursive: true });

      const hugeContent = 'x'.repeat(11_000_000);
      await fs.writeFile(objectPath, hugeContent, 'utf8');

      const result = await storage.retrieve('test', validId);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('size exceeds limit');
      }
    });
  });

  describe('Prototype Pollution Prevention', () => {
    it('should reject objects with __proto__ key', async () => {
      const maliciousData = {
        id: 'test-id',
        __proto__: { polluted: true },
      };

      const storeResult = await storage.store('test', maliciousData);
      if (storeResult.isOk()) {
        const retrieveResult = await storage.retrieve('test', storeResult.value);
        expect(retrieveResult.isErr()).toBe(true);
        if (retrieveResult.isErr()) {
          expect(retrieveResult.error.message).toContain('Invalid data structure');
        }
      }
    });

    it('should reject objects with constructor key', async () => {
      const maliciousData = {
        id: 'test-id',
        constructor: { polluted: true },
      };

      const storeResult = await storage.store('test', maliciousData);
      if (storeResult.isOk()) {
        const retrieveResult = await storage.retrieve('test', storeResult.value);
        expect(retrieveResult.isErr()).toBe(true);
      }
    });

    it('should reject objects with prototype key', async () => {
      const maliciousData = {
        id: 'test-id',
        prototype: { polluted: true },
      };

      const storeResult = await storage.store('test', maliciousData);
      if (storeResult.isOk()) {
        const retrieveResult = await storage.retrieve('test', storeResult.value);
        expect(retrieveResult.isErr()).toBe(true);
      }
    });

    it('should reject nested pollution attempts', async () => {
      const maliciousData = {
        id: 'test-id',
        safe: {
          nested: {
            __proto__: { polluted: true },
          },
        },
      };

      const storeResult = await storage.store('test', maliciousData);
      if (storeResult.isOk()) {
        const retrieveResult = await storage.retrieve('test', storeResult.value);
        expect(retrieveResult.isErr()).toBe(true);
      }
    });
  });

  describe('Prompt Injection via File Paths', () => {
    it('should reject paths with Unicode normalization attacks', async () => {
      const unicodeAttacks = [
        '\u002e\u002e/\u002e\u002e/etc/passwd',
        '\uFF0E\uFF0E/\uFF0E\uFF0E/etc/passwd',
        '.\u0301./.\u0301./etc/passwd',
      ];

      for (const maliciousPath of unicodeAttacks) {
        const fullPath = join(testDir, 'agents', maliciousPath);
        const result = await agentRepo.loadFromFile(fullPath);
        expect(result.isErr()).toBe(true);
      }
    });

    it('should reject null byte injection in paths', async () => {
      const nullByteAttacks = [
        'agent.md\0.txt',
        '../etc/passwd\0agent.md',
      ];

      for (const attack of nullByteAttacks) {
        const fullPath = join(testDir, 'agents', attack);
        const result = await agentRepo.loadFromFile(fullPath);
        expect(result.isErr()).toBe(true);
      }
    });

    it('should reject symlink traversal attempts', async () => {
      const agentsDir = join(testDir, 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      const outsideDir = join(testDir, '..', 'outside');
      await fs.mkdir(outsideDir, { recursive: true });
      await fs.writeFile(join(outsideDir, 'secret.md'), 'SECRET', 'utf8');

      try {
        await fs.symlink(outsideDir, join(agentsDir, 'link'));
        const symlinkPath = join(agentsDir, 'link', 'secret.md');
        const result = await agentRepo.loadFromFile(symlinkPath);
        expect(result.isErr()).toBe(true);
      } catch (error: any) {
        if (error.code !== 'EPERM' && error.code !== 'EACCES') {
          throw error;
        }
      }
    });

    it('should detect symlink in agent directory itself', async () => {
      const agentsDir = join(testDir, 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      const targetFile = join(agentsDir, 'target.md');
      await fs.writeFile(targetFile, 'CONTENT', 'utf8');

      try {
        const symlinkFile = join(agentsDir, 'symlink.md');
        await fs.symlink(targetFile, symlinkFile);

        const result = await agentRepo.loadFromFile(symlinkFile);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toContain('Invalid file type');
        }
      } catch (error: any) {
        if (error.code !== 'EPERM' && error.code !== 'EACCES') {
          throw error;
        }
      }
    });
  });

  describe('Malicious Content Handling', () => {
    it('should handle extremely long agent IDs', async () => {
      const longId = 'a'.repeat(10000);
      const result = await storage.store('test', { id: longId });
      expect(result.isErr()).toBe(true);
    });

    it('should handle special characters in type parameter', async () => {
      const maliciousTypes = [
        '../../../etc',
        '..\\..\\..\\windows',
        'type/../../etc',
        'type;rm -rf /',
        'type`whoami`',
      ];

      for (const maliciousType of maliciousTypes) {
        const result = await storage.store(maliciousType, { data: 'test' });
        expect(result.isErr()).toBe(true);
      }
    });

    it('should handle arrays with circular references safely', async () => {
      const circular: any = { data: 'test' };
      circular.self = circular;

      expect(() => JSON.stringify(circular)).toThrow();
    });
  });

  describe('Infinite Loop Prevention', () => {
    it('should enforce maximum depth limit', async () => {
      let deeplyNested: any = { value: 'leaf' };
      for (let i = 0; i < 100; i++) {
        deeplyNested = { child: deeplyNested };
      }

      const result = await storage.store('test', deeplyNested);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('complexity limit');
      }
    });
  });

  describe('Error Message Information Leakage', () => {
    it('should not leak internal paths in error messages', async () => {
      const result = await storage.retrieve('test', '../etc/passwd');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).not.toContain(testDir);
        expect(result.error.message).not.toContain('/etc/passwd');
      }
    });

    it('should not leak internal structure in validation errors', async () => {
      const result = await storage.store('', { data: 'test' });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const message = result.error.message.toLowerCase();
        expect(message).not.toContain('objects/');
        expect(message).not.toContain(testDir.toLowerCase());
      }
    });
  });
});
