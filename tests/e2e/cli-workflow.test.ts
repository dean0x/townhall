/**
 * E2E tests for complete CLI workflow
 * Tests the full debate simulation flow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

describe('Townhall CLI E2E Workflow', () => {
  const testDir = join(process.cwd(), '.townhall-test');
  const townhallDir = join(process.cwd(), '.townhall');
  const cliPath = join(process.cwd(), 'dist/index.js');

  beforeEach(async () => {
    // Clean both test and main townhall directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    if (existsSync(townhallDir)) {
      rmSync(townhallDir, { recursive: true, force: true });
    }

    // Wait a bit to ensure filesystem operations complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Initialize repository to ensure .townhall directory exists
    try {
      execSync(`node ${cliPath} init`, { encoding: 'utf8', timeout: 5000 });
    } catch (error) {
      // Retry once if init fails
      await new Promise(resolve => setTimeout(resolve, 100));
      execSync(`node ${cliPath} init`, { encoding: 'utf8', timeout: 5000 });
    }

    // Create test agent using exact format that works manually
    const agentDir = join(process.cwd(), '.townhall', 'agents');
    const agentFile = join(agentDir, 'test-agent.md');

    const fs = await import('fs/promises');
    await fs.mkdir(agentDir, { recursive: true });

    // Write exactly the same format that works manually
    await fs.writeFile(agentFile,
`---
id: f05482e4-324d-4b50-8be3-a49f870cd968
name: Test Agent
type: llm
capabilities: [debate, analysis]
---
A test agent for debugging purposes.`, 'utf8');

    // Ensure file write completes
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(() => {
    // Cleanup both directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    if (existsSync(townhallDir)) {
      rmSync(townhallDir, { recursive: true, force: true });
    }
  });

  describe('Complete debate workflow', () => {
    it('should initialize repository and run full debate', () => {
      // Repository already initialized in beforeEach
      expect(existsSync('.townhall')).toBe(true);

      // Start debate
      const simulateResult = execSync(
        `node ${cliPath} simulate debate "Test topic"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(simulateResult).toContain('Debate initialized');
      expect(simulateResult).toContain('Test topic');

      // Submit argument
      const agentId = 'f05482e4-324d-4b50-8be3-a49f870cd968';
      const argResult = execSync(
        `node ${cliPath} argument --agent ${agentId} --type deductive ` +
        `--premise "First premise" --premise "Second premise" ` +
        `--conclusion "Test conclusion"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(argResult).toContain('Argument created');

      // View log
      const logResult = execSync(`node ${cliPath} log`, { encoding: 'utf8', cwd: process.cwd() });
      expect(logResult).toContain('Test topic');
      expect(logResult).toContain('[active]');

      // Vote to close
      const voteResult = execSync(
        `node ${cliPath} vote --agent ${agentId} --yes`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(voteResult).toContain('Vote cast successfully');
    });
  });

  describe('Command validation', () => {
    it('should reject invalid argument types', () => {
      try {
        execSync(
          `node ${cliPath} argument --agent test --type invalid`,
          { encoding: 'utf8' }
        );
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('invalid');
      }
    });

    it('should require active debate for arguments', () => {
      try {
        const output = execSync(
          `node ${cliPath} argument --agent f05482e4-324d-4b50-8be3-a49f870cd968 --type deductive --premise "Test premise" --conclusion "Test conclusion"`,
          { encoding: 'utf8' }
        );
        expect.fail('Should have thrown error');
      } catch (error: any) {
        // Check both stdout and stderr, as well as the error message
        const output = (error.stdout || '') + (error.stderr || '') + (error.message || '');
        expect(output).toContain('No active debate found');
      }
    });
  });
});