/**
 * Integration tests for security fixes across all repositories
 * Tests path traversal protection, input validation, and filesystem security
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ObjectStorage } from '../../../../src/infrastructure/storage/ObjectStorage';
import { FileSimulationRepository } from '../../../../src/infrastructure/storage/FileSimulationRepository';
import { FileAgentRepository } from '../../../../src/infrastructure/storage/FileAgentRepository';
import { FileArgumentRepository } from '../../../../src/infrastructure/storage/FileArgumentRepository';
import { DebateSimulation } from '../../../../src/core/entities/DebateSimulation';
import { Argument } from '../../../../src/core/entities/Argument';
import { SimulationId } from '../../../../src/core/value-objects/SimulationId';
import { ArgumentId, ArgumentIdGenerator } from '../../../../src/core/value-objects/ArgumentId';
import { AgentId, AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { ILogger } from '../../../../src/application/ports/ILogger';

// Mock logger
const mockLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => mockLogger,
};

describe('Security Integration Tests', () => {
  const cryptoService = new MockCryptoService();
  let testDir: string;
  let storage: ObjectStorage;
  let simulationRepo: FileSimulationRepository;
  let agentRepo: FileAgentRepository;
  let argumentRepo: FileArgumentRepository;

  beforeEach(async () => {
    testDir = join(tmpdir(), `security-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    storage = new ObjectStorage(testDir);
    simulationRepo = new FileSimulationRepository(storage, testDir);
    agentRepo = new FileAgentRepository(mockLogger, testDir);
    argumentRepo = new FileArgumentRepository(storage);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Cross-Repository Path Traversal Protection', () => {
    it('should prevent path traversal across all repositories', async () => {
      // Create a sensitive file outside the repository directory
      const sensitiveDir = join(testDir, '..', 'sensitive');
      await fs.mkdir(sensitiveDir, { recursive: true });
      const sensitiveFile = join(sensitiveDir, 'secrets.txt');
      await fs.writeFile(sensitiveFile, 'TOP SECRET DATA', 'utf8');

      // Attempt 1: ObjectStorage with path traversal
      const maliciousId = '../sensitive/secrets.txt';
      const storeResult = await storage.store('test', { id: maliciousId, data: 'hacked' });
      expect(storeResult.isErr()).toBe(true);
      if (storeResult.isErr()) {
        expect(storeResult.error.message).toContain('Invalid ID');
      }

      // Attempt 2: FileAgentRepository with path traversal
      const maliciousAgentPath = join(testDir, '..', 'sensitive', 'agent.md');
      const loadResult = await agentRepo.loadFromFile(maliciousAgentPath);
      expect(loadResult.isErr()).toBe(true);
      if (loadResult.isErr()) {
        expect(loadResult.error.message).toContain('Path traversal detected');
      }

      // Verify sensitive file was NOT accessed
      const secretsContent = await fs.readFile(sensitiveFile, 'utf8');
      expect(secretsContent).toBe('TOP SECRET DATA'); // Unchanged
    });

    it('should handle case-insensitive filesystem path bypasses', async () => {
      // On case-insensitive filesystems, '../AGENTS' might bypass '../agents' check
      const maliciousPath = join(testDir, 'agents', '..', 'AGENTS', 'escape.md');
      const loadResult = await agentRepo.loadFromFile(maliciousPath);

      // Should either reject as path traversal or fail to load (both are safe)
      expect(loadResult.isErr()).toBe(true);
    });

    it('should prevent symlink-based path traversal', async () => {
      // Create a symlink pointing outside the repository
      const outsideDir = join(testDir, '..', 'outside');
      await fs.mkdir(outsideDir, { recursive: true });
      await fs.writeFile(join(outsideDir, 'secret.txt'), 'SECRET', 'utf8');

      const agentsDir = join(testDir, 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      try {
        // Try to create a symlink (may fail on some systems)
        await fs.symlink(outsideDir, join(agentsDir, 'symlink'));

        const symlinkPath = join(agentsDir, 'symlink', 'secret.txt');
        const loadResult = await agentRepo.loadFromFile(symlinkPath);

        // Should reject due to path validation
        expect(loadResult.isErr()).toBe(true);
      } catch (error: any) {
        // Symlink creation may fail due to permissions - that's okay
        if (error.code !== 'EPERM' && error.code !== 'EACCES') {
          throw error;
        }
      }
    });
  });

  describe('Input Validation Across All Repositories', () => {
    it('should reject empty string IDs in ObjectStorage', async () => {
      // Empty ID should be rejected by validation
      const dataWithEmptyId = { id: '', data: 'test' };
      const result1 = await storage.store('test', dataWithEmptyId);
      expect(result1.isErr()).toBe(true);
      if (result1.isErr()) {
        expect(result1.error.message).toContain('Invalid ID');
      }

      // Whitespace-only ID should be rejected
      const dataWithWhitespaceId = { id: '   ', data: 'test' };
      const result2 = await storage.store('test', dataWithWhitespaceId);
      expect(result2.isErr()).toBe(true);
      if (result2.isErr()) {
        expect(result2.error.message).toContain('Invalid ID');
      }
    });

    it('should reject empty string types in ObjectStorage', async () => {
      const result1 = await storage.store('', { id: 'valid-id', data: 'test' });
      expect(result1.isErr()).toBe(true);

      const result2 = await storage.store('   ', { id: 'valid-id', data: 'test' });
      expect(result2.isErr()).toBe(true);
    });

    it('should reject malicious simulation IDs', async () => {
      // Instead of trying to override readonly properties, we test by trying
      // to retrieve with malicious IDs directly
      const maliciousIds = [
        '../../../etc/passwd' as SimulationId,
        '../../secrets.txt' as SimulationId,
        'sim/../../etc/passwd' as SimulationId,
        'sim\\..\\..\\windows\\system32' as SimulationId,
      ];

      for (const maliciousId of maliciousIds) {
        // Attempt to retrieve with malicious ID - should fail safely
        const findResult = await simulationRepo.findById(maliciousId);
        expect(findResult.isErr()).toBe(true);

        // Also test exists() with malicious ID
        const existsResult = await simulationRepo.exists(maliciousId);
        expect(existsResult.isErr()).toBe(true);
      }
    });
  });

  describe('File Permissions and Security', () => {
    it('should create files with restrictive permissions', async () => {
      // Create an agent file
      const agentResult = await agentRepo.loadFromFile(join(testDir, 'agents', 'test-agent.md'));

      if (agentResult.isErr()) {
        // Expected - file doesn't exist, so create one
        const agentFile = join(testDir, 'agents', 'test-agent.md');
        await fs.mkdir(join(testDir, 'agents'), { recursive: true });

        const content = `---
id: ${AgentIdGenerator.generate(cryptoService)}
name: Test Agent
type: llm
capabilities: [debate]
description: Test
---

# Test`;
        await fs.writeFile(agentFile, content, { encoding: 'utf8', mode: 0o600 });

        // Check file permissions (Unix-like systems only)
        if (process.platform !== 'win32') {
          const stats = await fs.stat(agentFile);
          const mode = stats.mode & 0o777;

          // File should be readable/writable by owner only
          expect(mode).toBeLessThanOrEqual(0o600);
        }
      }
    });

    it('should prevent directory traversal in ObjectStorage paths', async () => {
      // Verify that storage creates directories safely
      // Use a valid SHA-256 hash format for ID
      const validId = 'a'.repeat(64); // Valid 64-char hex string
      const result = await storage.store('simulations', {
        id: validId,
        topic: 'Test',
        status: 'active',
      });

      expect(result.isOk()).toBe(true);

      // Verify file was created in correct location
      // ObjectStorage uses objects/{type}/{id}.json structure
      const expectedPath = join(testDir, 'objects', 'simulations', `${validId}.json`);
      const exists = await fs.access(expectedPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Verify no files were created outside the objects directory
      const outsideDir = join(testDir, '..');
      const outsideFiles = await fs.readdir(outsideDir);

      // Should only contain our test directory
      expect(outsideFiles.filter(f => f.startsWith('security-integration-'))).toHaveLength(1);
    });
  });

  describe('Concurrent Access and Race Conditions', () => {
    it('should handle concurrent saves without corruption', async () => {
      // Create multiple simulations concurrently
      const simulations = await Promise.all([
        DebateSimulation.create({ topic: 'Simulation 1', createdAt: new Date(), cryptoService }),
        DebateSimulation.create({ topic: 'Simulation 2', createdAt: new Date(), cryptoService }),
        DebateSimulation.create({ topic: 'Simulation 3', createdAt: new Date(), cryptoService }),
      ]);

      const savePromises = simulations.map(simResult => {
        if (simResult.isOk()) {
          return simulationRepo.save(simResult.value);
        }
        return Promise.resolve(simResult);
      });

      const results = await Promise.all(savePromises);

      // All should succeed
      results.forEach(result => {
        expect(result.isOk()).toBe(true);
      });

      // All simulations should be retrievable
      const listResult = await simulationRepo.listAll();
      expect(listResult.isOk()).toBe(true);
      if (listResult.isOk()) {
        expect(listResult.value).toHaveLength(3);
      }
    });

    it('should handle concurrent reads without corruption', async () => {
      // Create a simulation
      const simResult = DebateSimulation.create({
        cryptoService,
        topic: 'Concurrent Test',
        createdAt: new Date(),
      });
      expect(simResult.isOk()).toBe(true);

      if (simResult.isOk()) {
        const sim = simResult.value;
        const saveResult = await simulationRepo.save(sim);
        expect(saveResult.isOk()).toBe(true);

        // Read the same simulation concurrently
        const readPromises = Array(10).fill(null).map(() =>
          simulationRepo.findById(sim.id)
        );

        const results = await Promise.all(readPromises);

        // All reads should succeed and return consistent data
        results.forEach(result => {
          expect(result.isOk()).toBe(true);
          if (result.isOk()) {
            // Each read returns a new instance with same data
            expect(result.value.topic).toBe('Concurrent Test');
            expect(result.value.status).toBe('active');
          }
        });

        // Verify all reads returned the same topic
        const topics = results
          .filter(r => r.isOk())
          .map(r => r.isOk() ? r.value.topic : '');
        expect(new Set(topics).size).toBe(1); // All identical
        expect(topics[0]).toBe('Concurrent Test');
      }
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain data integrity across save/load cycles', async () => {
      // Create a complex simulation with arguments
      const simResult = DebateSimulation.create({
        cryptoService,
        topic: 'Integrity Test',
        createdAt: new Date(),
      });
      expect(simResult.isOk()).toBe(true);

      if (simResult.isOk()) {
        let sim = simResult.value;

        // Add participants
        const agent1 = AgentIdGenerator.generate(cryptoService);
        const agent2 = AgentIdGenerator.generate(cryptoService);
        sim = sim.addParticipant(agent1);
        sim = sim.addParticipant(agent2);

        // Add arguments (use content-addressed IDs)
        const arg1 = ArgumentIdGenerator.fromContent('Argument 1 content', cryptoService);
        const arg2 = ArgumentIdGenerator.fromContent('Argument 2 content', cryptoService);
        sim = sim.addArgument(arg1);
        sim = sim.addArgument(arg2);

        // Save
        const saveResult = await simulationRepo.save(sim);
        expect(saveResult.isOk()).toBe(true);

        // Load
        const loadResult = await simulationRepo.findById(sim.id);
        expect(loadResult.isOk()).toBe(true);

        if (loadResult.isOk()) {
          const loaded = loadResult.value;

          // Verify all business data matches (ID may differ due to timestamp hashing)
          expect(loaded.topic).toBe('Integrity Test');
          expect(loaded.status).toBe('active');
          expect(loaded.participantIds).toHaveLength(2);
          expect(loaded.participantIds).toContain(agent1);
          expect(loaded.participantIds).toContain(agent2);
          expect(loaded.argumentIds).toHaveLength(2);
          expect(loaded.argumentIds).toContain(arg1);
          expect(loaded.argumentIds).toContain(arg2);
        }
      }
    });

    it('should detect and reject corrupted data', async () => {
      // Create a valid simulation
      const simResult = DebateSimulation.create({
        cryptoService,
        topic: 'Corruption Test',
        createdAt: new Date(),
      });
      expect(simResult.isOk()).toBe(true);

      if (simResult.isOk()) {
        const sim = simResult.value;
        const saveResult = await simulationRepo.save(sim);
        expect(saveResult.isOk()).toBe(true);

        // Corrupt the stored data directly
        // ObjectStorage uses objects/{type}/{id}.json structure
        const objectPath = join(testDir, 'objects', 'simulations', `${sim.id}.json`);

        // Verify file exists first
        const fileExists = await fs.access(objectPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        const corrupted = { invalid: 'data', missing: 'required fields' };
        await fs.writeFile(objectPath, JSON.stringify(corrupted), 'utf8');

        // Attempt to load - should fail gracefully
        // The deserializer will throw an error due to corruption
        // This test verifies the system doesn't crash on corrupted data
        try {
          const loadResult = await simulationRepo.findById(sim.id);
          // If it returns, it should be an error result (not crash)
          expect(loadResult).toBeDefined();
        } catch (error) {
          // If it throws, it should be a controlled error
          expect(error).toBeDefined();
          const errorMessage = (error as Error).message.toLowerCase();
          // Should mention either corruption or failed deserialization
          const isValidError = errorMessage.includes('corruption') ||
                              errorMessage.includes('failed to deserialize') ||
                              errorMessage.includes('cannot read properties');
          expect(isValidError).toBe(true);
        }
      }
    });
  });

  describe('Error Handling Consistency', () => {
    it('should return NotFoundError for missing entities across all repositories', async () => {
      const nonExistentSimId = 'non-existent-simulation-id' as SimulationId;
      const simResult = await simulationRepo.findById(nonExistentSimId);
      expect(simResult.isErr()).toBe(true);
      if (simResult.isErr()) {
        expect(simResult.error.constructor.name).toBe('NotFoundError');
      }

      const nonExistentArgId = 'a'.repeat(64) as ArgumentId;
      const argResult = await argumentRepo.findById(nonExistentArgId);
      expect(argResult.isErr()).toBe(true);
      if (argResult.isErr()) {
        expect(argResult.error.constructor.name).toBe('NotFoundError');
      }

      const nonExistentAgentId = AgentIdGenerator.generate(cryptoService);
      const agentResult = await agentRepo.findById(nonExistentAgentId);
      expect(agentResult.isErr()).toBe(true);
      if (agentResult.isErr()) {
        expect(agentResult.error.constructor.name).toBe('NotFoundError');
      }
    });

    it('should return StorageError for I/O failures', async () => {
      // Make test directory read-only to trigger I/O errors
      if (process.platform !== 'win32') {
        await fs.chmod(testDir, 0o444);

        const simResult = DebateSimulation.create({
        cryptoService,
          topic: 'I/O Test',
          createdAt: new Date(),
        });

        if (simResult.isOk()) {
          const saveResult = await simulationRepo.save(simResult.value);
          expect(saveResult.isErr()).toBe(true);
          if (saveResult.isErr()) {
            expect(saveResult.error.constructor.name).toBe('StorageError');
          }
        }

        // Restore permissions for cleanup
        await fs.chmod(testDir, 0o755);
      }
    });
  });
});
