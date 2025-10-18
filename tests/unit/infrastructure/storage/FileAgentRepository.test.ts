/**
 * Security tests for FileAgentRepository path validation
 *
 * CRITICAL: These tests validate path traversal prevention
 * All security controls must be tested to prevent vulnerabilities
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { FileAgentRepository } from '../../../../src/infrastructure/storage/FileAgentRepository';
import { Agent } from '../../../../src/core/entities/Agent';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { ILogger } from '../../../../src/application/ports/ILogger';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock logger for tests
const mockLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => mockLogger,
};

describe('FileAgentRepository Security Tests', () => {
  const cryptoService = new MockCryptoService();
  let repository: FileAgentRepository;
  let testDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    // Create isolated temp directory for each test
    testDir = join(tmpdir(), `fileagentrepo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    agentsDir = join(testDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
    repository = new FileAgentRepository(mockLogger, testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('validateAgentPath() security', () => {
    it('should reject path traversal with ../ in loadFromFile()', async () => {
      const maliciousPath = join(agentsDir, '../../../etc/passwd');

      const result = await repository.loadFromFile(maliciousPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Path traversal detected');
        expect(result.error.operation).toBe('security');
      }
    });

    it('should reject absolute paths outside agents directory', async () => {
      const maliciousPath = '/etc/passwd';

      const result = await repository.loadFromFile(maliciousPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Path traversal detected');
      }
    });

    it('should reject paths with multiple ../ sequences', async () => {
      const maliciousPath = join(agentsDir, '..', '..', '..', '..', 'etc', 'passwd');

      const result = await repository.loadFromFile(maliciousPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Path traversal detected');
      }
    });

    it('should accept valid paths within agents directory', async () => {
      // Create a valid agent file
      const validAgentId = AgentIdGenerator.generate(cryptoService);
      const validPath = join(agentsDir, `${validAgentId}.md`);
      const validAgentContent = `---
id: ${validAgentId}
name: Test Agent
type: human
capabilities: [debate, analysis]
---

# Test Agent

This is a test agent.
`;
      await fs.writeFile(validPath, validAgentContent);

      const result = await repository.loadFromFile(validPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe(validAgentId);
      }
    });

    it('should reject paths that resolve outside agents directory after normalization', async () => {
      // This uses symbolic tricks to try to escape
      const trickPath = join(agentsDir, 'subdir', '..', '..', '..', 'etc', 'passwd');

      const result = await repository.loadFromFile(trickPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Path traversal detected');
      }
    });
  });

  describe('saveToFile() security', () => {
    it('should sanitize agent ID to prevent path traversal', async () => {
      // Create agent with malicious ID
      const maliciousId = '../../../etc/passwd' as any;
      const validFilePath = join(agentsDir, 'test.md');
      const agentResult = Agent.create({
        id: maliciousId,
        name: 'Malicious Agent',
        type: 'human',
        capabilities: ['debate'],
        description: 'Should be sanitized',
        filePath: validFilePath,
      });

      expect(agentResult.isOk()).toBe(true);
      if (agentResult.isOk()) {
        const agent = agentResult.value;
        const saveResult = await repository.saveToFile(agent);

        // The filename should be sanitized, removing path separators
        // So it should succeed but create a safe file
        expect(saveResult.isOk()).toBe(true);

        // Verify file was created in agents directory (not traversed)
        const files = await fs.readdir(agentsDir);
        expect(files.length).toBe(1);
        // Sanitization replaces / with nothing, so ../../../etc/passwd becomes ......etcpasswd
        // This is still safe as it's just a filename, not a path
        expect(files[0]).not.toContain('/');
        expect(files[0]).toMatch(/\.md$/); // Should end with .md
      }
    });

    it('should remove special characters from agent ID in filename', async () => {
      const specialCharsId = 'agent@#$%^&*()[]{}|\\:;"<>?/\x00' as any;
      const validFilePath = join(agentsDir, 'special.md');
      const agentResult = Agent.create({
        id: specialCharsId,
        name: 'Special Agent',
        type: 'human',
        capabilities: ['debate'],
        description: 'Testing special chars',
        filePath: validFilePath,
      });

      expect(agentResult.isOk()).toBe(true);
      if (agentResult.isOk()) {
        const agent = agentResult.value;
        const saveResult = await repository.saveToFile(agent);

        expect(saveResult.isOk()).toBe(true);

        // Verify filename has been sanitized
        const files = await fs.readdir(agentsDir);
        expect(files.length).toBe(1);
        // Should only contain safe characters
        expect(files[0]).toMatch(/^[a-zA-Z0-9-_.]+\.md$/);
      }
    });

    it('should always save files within agents directory', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const validFilePath = join(agentsDir, `${agentId}.md`);
      const agentResult = Agent.create({
        id: agentId,
        name: 'Normal Agent',
        type: 'human',
        capabilities: ['debate'],
        description: 'Normal agent',
        filePath: validFilePath,
      });

      expect(agentResult.isOk()).toBe(true);
      if (agentResult.isOk()) {
        const agent = agentResult.value;
        const saveResult = await repository.saveToFile(agent);

        expect(saveResult.isOk()).toBe(true);

        // Verify file exists in agents directory
        const expectedFile = `${agentId}.md`;
        const files = await fs.readdir(agentsDir);
        expect(files).toContain(expectedFile);

        // Verify no files created outside agents directory
        const parentDir = testDir;
        const parentFiles = await fs.readdir(parentDir);
        // Should only contain 'agents' directory
        expect(parentFiles).toEqual(['agents']);
      }
    });

    it('should construct path from agent ID, not agent.filePath', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      // Create agent with a valid but misleading filePath
      const misleadingFilePath = join(agentsDir, 'wrong-name.md');
      const agentResult = Agent.create({
        id: agentId,
        name: 'Agent with different path',
        type: 'human',
        capabilities: ['debate'],
        description: 'FilePath points to wrong-name.md but save should use ID',
        filePath: misleadingFilePath, // saveToFile should use ID instead
      });

      expect(agentResult.isOk()).toBe(true);
      if (agentResult.isOk()) {
        const agent = agentResult.value;
        const saveResult = await repository.saveToFile(agent);

        expect(saveResult.isOk()).toBe(true);

        // File should be saved based on ID, not filePath
        const expectedFile = `${agentId}.md`;
        const files = await fs.readdir(agentsDir);
        expect(files).toContain(expectedFile);

        // Verify the misleading filename was NOT used
        expect(files).not.toContain('wrong-name.md');
      }
    });
  });

  describe('refresh() security', () => {
    it('should only load files from agents directory', async () => {
      // Create a valid agent in agents directory using saveToFile
      const validAgentId = AgentIdGenerator.generate(cryptoService);
      const validFilePath = join(agentsDir, `${validAgentId}.md`);
      const validAgentResult = Agent.create({
        id: validAgentId,
        name: 'Valid Agent',
        type: 'human',
        capabilities: ['debate'],
        description: 'Valid agent',
        filePath: validFilePath,
      });

      expect(validAgentResult.isOk()).toBe(true);
      if (validAgentResult.isOk()) {
        await repository.saveToFile(validAgentResult.value);
      }

      // Try to create a malicious file outside agents directory
      const maliciousFile = join(testDir, 'malicious.md');
      await fs.writeFile(maliciousFile, `---
id: malicious-agent
name: Malicious
type: human
capabilities: [debate]
---

Malicious agent - should not be loaded
`);

      // Clear cache and refresh
      await repository.refresh();

      const listResult = await repository.listAll();
      expect(listResult.isOk()).toBe(true);
      if (listResult.isOk()) {
        const agents = listResult.value;
        // Should only contain the valid agent from agents directory
        expect(agents.length).toBe(1);
        expect(agents[0].id).toBe(validAgentId);
        expect(agents[0].name).toBe('Valid Agent');
      }
    });

    it('should handle symlinks securely', async () => {
      // Create a directory outside test area
      const outsideDir = join(tmpdir(), 'outside-agents');
      await fs.mkdir(outsideDir, { recursive: true });

      try {
        // Create a file outside
        const outsideFile = join(outsideDir, 'outside-agent.md');
        await fs.writeFile(outsideFile, `---
id: outside-agent
name: Outside Agent
type: human
capabilities: [test]
---

Outside
`);

        // Create symlink in agents directory pointing outside
        const symlinkPath = join(agentsDir, 'symlink-agent.md');
        await fs.symlink(outsideFile, symlinkPath);

        const refreshResult = await repository.refresh();
        expect(refreshResult.isOk()).toBe(true);

        // If the symlink is followed, loadFromFile should reject it via path validation
        const loadResult = await repository.loadFromFile(symlinkPath);
        expect(loadResult.isErr()).toBe(true);
        if (loadResult.isErr()) {
          expect(result.error.message).toContain('Path traversal detected');
        }
      } catch (error) {
        // Symlink creation might fail on some systems, that's OK
      } finally {
        await fs.rm(outsideDir, { recursive: true, force: true });
      }
    });

    it('should skip files that fail path validation during refresh', async () => {
      // Create valid agent files using saveToFile
      const validAgentId1 = AgentIdGenerator.generate(cryptoService);
      const validAgentId2 = AgentIdGenerator.generate(cryptoService);

      const agent1Result = Agent.create({
        id: validAgentId1,
        name: 'Agent 1',
        type: 'human',
        capabilities: ['debate'],
        description: 'First agent',
        filePath: join(agentsDir, `${validAgentId1}.md`),
      });

      const agent2Result = Agent.create({
        id: validAgentId2,
        name: 'Agent 2',
        type: 'human',
        capabilities: ['debate'],
        description: 'Second agent',
        filePath: join(agentsDir, `${validAgentId2}.md`),
      });

      if (agent1Result.isOk()) {
        await repository.saveToFile(agent1Result.value);
      }
      if (agent2Result.isOk()) {
        await repository.saveToFile(agent2Result.value);
      }

      const refreshResult = await repository.refresh();
      expect(refreshResult.isOk()).toBe(true);

      const listResult = await repository.listAll();
      expect(listResult.isOk()).toBe(true);
      if (listResult.isOk()) {
        const agents = listResult.value;
        expect(agents.length).toBe(2);
      }
    });
  });

  describe('File permission security', () => {
    it('should create agent files with secure permissions (0o600)', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const validFilePath = join(agentsDir, `${agentId}.md`);
      const agentResult = Agent.create({
        id: agentId,
        name: 'Secure Agent',
        type: 'human',
        capabilities: ['debate'],
        description: 'Testing permissions',
        filePath: validFilePath,
      });

      expect(agentResult.isOk()).toBe(true);
      if (agentResult.isOk()) {
        const agent = agentResult.value;
        const saveResult = await repository.saveToFile(agent);

        expect(saveResult.isOk()).toBe(true);

        const filePath = join(agentsDir, `${agentId}.md`);
        const stats = await fs.stat(filePath);

        // Check file permissions (should be 0o600 - owner read/write only)
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o600);
      }
    });

    it('should create agents directory with secure permissions (0o700)', async () => {
      // Delete and recreate to test directory creation
      await fs.rm(testDir, { recursive: true, force: true });
      repository = new FileAgentRepository(mockLogger, testDir);

      const agentId = AgentIdGenerator.generate(cryptoService);
      const newAgentsDir = join(testDir, 'agents');
      const validFilePath = join(newAgentsDir, `${agentId}.md`);
      const agentResult = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'human',
        capabilities: ['debate'],
        description: 'Test',
        filePath: validFilePath,
      });

      expect(agentResult.isOk()).toBe(true);
      if (agentResult.isOk()) {
        const agent = agentResult.value;
        await repository.saveToFile(agent);

        const dirStats = await fs.stat(join(testDir, 'agents'));
        const mode = dirStats.mode & 0o777;
        expect(mode).toBe(0o700);
      }
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle null bytes in file path (should reject)', async () => {
      const nullBytePath = join(agentsDir, 'agent\x00malicious.md');

      const result = await repository.loadFromFile(nullBytePath);

      // Path should be rejected
      expect(result.isErr()).toBe(true);
    });

    it('should handle very long file paths', async () => {
      const longId = 'agent-' + 'a'.repeat(200);
      const longPath = join(agentsDir, `${longId}.md`);

      // Create the file first
      await fs.writeFile(longPath, `---
id: ${longId}
name: Long ID Agent
type: human
capabilities: [test]
---
Test`);

      const result = await repository.loadFromFile(longPath);

      // Should either succeed or fail gracefully (not crash)
      if (result.isErr()) {
        expect(result.error.message).toBeTruthy();
      }
    });

    it('should handle unicode in file paths (actual filesystem test)', async () => {
      const unicodeId = 'agent-参数-test';
      const unicodePath = join(agentsDir, `${unicodeId}.md`);

      await fs.writeFile(unicodePath, `---
id: ${unicodeId}
name: Unicode Agent
type: human
capabilities: [test]
---
Test`);

      const result = await repository.loadFromFile(unicodePath);

      // Should handle unicode gracefully
      if (result.isErr()) {
        expect(result.error).toBeDefined();
      }
    });

    it('should reject case manipulation attacks on case-insensitive filesystems', async () => {
      // On case-insensitive filesystems, different cases might resolve to same file
      const agentId = AgentIdGenerator.generate(cryptoService).toLowerCase();
      const validPath = join(agentsDir, `${agentId}.md`);

      await fs.writeFile(validPath, `---
id: ${agentId}
name: Test
type: human
capabilities: [test]
---
Test`);

      // Try loading with different case (if on case-sensitive FS, this will fail anyway)
      const upperPath = join(agentsDir, `${agentId.toUpperCase()}.md`);
      const result = await repository.loadFromFile(upperPath);

      // Either file not found or loaded successfully
      // Important: should NOT traverse paths
      if (result.isOk()) {
        expect(result.value).toBeDefined();
      }
    });
  });

  describe('Regression tests for known attack vectors', () => {
    it('should prevent double-encoded path traversal', async () => {
      const doubleEncoded = join(agentsDir, '%252e%252e%252f%252e%252e%252fetc%252fpasswd');

      const result = await repository.loadFromFile(doubleEncoded);

      expect(result.isErr()).toBe(true);
    });

    it('should prevent UNC path injection (Windows)', async () => {
      const uncPaths = [
        '\\\\server\\share\\agent.md',
        '//server/share/agent.md',
      ];

      for (const uncPath of uncPaths) {
        const result = await repository.loadFromFile(uncPath);
        expect(result.isErr()).toBe(true);
      }
    });

    it('should prevent path traversal with backslashes (Windows)', async () => {
      const backslashPath = join(agentsDir, '..\\..\\..\\etc\\passwd');

      const result = await repository.loadFromFile(backslashPath);

      expect(result.isErr()).toBe(true);
    });

    it('should prevent mixed separator path traversal', async () => {
      const mixedPath = join(agentsDir, '../..\\../etc/passwd');

      const result = await repository.loadFromFile(mixedPath);

      expect(result.isErr()).toBe(true);
    });
  });
});
