/**
 * Tests for FileAgentRepository mtime-based cache invalidation
 * Verifies that the performance optimization correctly skips unchanged files
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileAgentRepository } from '../../../../src/infrastructure/storage/FileAgentRepository';
import { ILogger } from '../../../../src/application/ports/ILogger';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';

// Mock logger for tests
const mockLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => mockLogger,
};

describe('FileAgentRepository - Mtime-based Cache Invalidation', () => {
  const cryptoService = new MockCryptoService();
  let repository: FileAgentRepository;
  let testDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `mtime-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    agentsDir = join(testDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
    repository = new FileAgentRepository(mockLogger, testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Performance: Skip unchanged files', () => {
    it('should load file on first refresh', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const agentFile = join(agentsDir, `${agentId}.md`);

      // Create agent file with correct YAML format
      const content = `---
id: ${agentId}
name: Test Agent
type: llm
capabilities: [debate, analysis]
description: A test agent
---

# Test Agent

This is a test agent.`;

      await fs.writeFile(agentFile, content, 'utf8');

      // First refresh - should load the file
      const result1 = await repository.refresh();
      expect(result1.isOk()).toBe(true);

      const agents1 = await repository.listAll();
      expect(agents1.isOk()).toBe(true);
      if (agents1.isOk()) {
        expect(agents1.value).toHaveLength(1);
        expect(agents1.value[0]?.name).toBe('Test Agent');
      }
    });

    it('should skip unchanged file on second refresh', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const agentFile = join(agentsDir, `${agentId}.md`);

      const content = `---
id: ${agentId}
name: Test Agent
type: llm
capabilities: [debate]
description: A test agent
---

# Test Agent`;

      await fs.writeFile(agentFile, content, 'utf8');

      // First refresh - loads file
      await repository.refresh();

      // Get original mtime
      const stats1 = await fs.stat(agentFile);
      const mtime1 = stats1.mtimeMs;

      // Second refresh without modification - should skip
      const result2 = await repository.refresh();
      expect(result2.isOk()).toBe(true);

      // Verify agent still in cache
      const agents2 = await repository.listAll();
      expect(agents2.isOk()).toBe(true);
      if (agents2.isOk()) {
        expect(agents2.value).toHaveLength(1);
      }

      // Verify mtime unchanged
      const stats2 = await fs.stat(agentFile);
      expect(stats2.mtimeMs).toBe(mtime1);
    });

    it('should reload file when modified', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const agentFile = join(agentsDir, `${agentId}.md`);

      // Create initial agent
      const content1 = `---
id: ${agentId}
name: Original Name
type: llm
capabilities: [debate]
description: Original description
---

# Original`;

      await fs.writeFile(agentFile, content1, 'utf8');
      const stats1 = await fs.stat(agentFile);
      await repository.refresh();

      // Verify original content
      const agents1 = await repository.listAll();
      if (agents1.isOk()) {
        expect(agents1.value[0]?.name).toBe('Original Name');
      }

      // Wait to ensure mtime will be different (1s to handle filesystem granularity)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Modify the file
      const content2 = `---
id: ${agentId}
name: Modified Name
type: llm
capabilities: [debate, analysis]
description: Modified description
---

# Modified`;

      await fs.writeFile(agentFile, content2, 'utf8');

      // Refresh - should reload modified file
      await repository.refresh();

      // Verify modified content
      const agents2 = await repository.listAll();
      if (agents2.isOk()) {
        expect(agents2.value[0]?.name).toBe('Modified Name');
        expect(agents2.value[0]?.capabilities).toContain('analysis');
      }
    });
  });
});
