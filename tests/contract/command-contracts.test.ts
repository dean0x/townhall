/**
 * Contract tests for command/query handlers
 * Ensures handlers conform to expected interfaces
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { container } from 'tsyringe';
import { configureContainer } from '../../src/interfaces/cli/container-config';
import { TOKENS } from '../../src/shared/container';
import { ICommandBus } from '../../src/application/handlers/CommandBus';
import { IQueryBus } from '../../src/application/handlers/QueryBus';
import { InitializeDebateCommand } from '../../src/application/commands/InitializeDebateCommand';
import { CreateArgumentCommand } from '../../src/application/commands/CreateArgumentCommand';
import { GetDebateHistoryQuery } from '../../src/application/queries/GetDebateHistoryQuery';

describe('Command/Query Handler Contracts', () => {
  let commandBus: ICommandBus;
  let queryBus: IQueryBus;

  beforeEach(async () => {
    // Clean up any existing .townhall directory
    try {
      const fs = await import('fs/promises');
      await fs.rm('.townhall', { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }

    container.clearInstances();
    configureContainer();
    commandBus = container.resolve(TOKENS.CommandBus);
    queryBus = container.resolve(TOKENS.QueryBus);
  });

  afterEach(async () => {
    // Clean up after each test to ensure isolation
    try {
      const fs = await import('fs/promises');
      await fs.rm('.townhall', { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }
  });


  describe('InitializeDebateCommand', () => {
    it('should return debate details on success', async () => {
      const command: InitializeDebateCommand = {
        topic: 'Test debate topic'
      };

      const result = await commandBus.execute(command, 'InitializeDebateCommand');

      // Debug output
      if (result.isErr()) {
        console.error('InitializeDebateCommand failed:', result.error);
      }

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveProperty('simulationId');
        expect(result.value).toHaveProperty('topic');
        expect(result.value).toHaveProperty('createdAt');
        expect(result.value.topic).toBe('Test debate topic');
      }
    });

    it('should allow multiple simulations with auto-checkout', async () => {
      // Start first debate
      const firstResult = await commandBus.execute(
        { topic: 'First debate' },
        'InitializeDebateCommand'
      );

      // Ensure first debate was created successfully
      expect(firstResult.isOk()).toBe(true);

      // Start second debate (should succeed and auto-checkout)
      const secondResult = await commandBus.execute(
        { topic: 'Second debate' },
        'InitializeDebateCommand'
      );

      expect(secondResult.isOk()).toBe(true);
      if (secondResult.isOk()) {
        expect(secondResult.value.topic).toBe('Second debate');
      }
    });
  });

  describe('CreateArgumentCommand', () => {
    beforeEach(async () => {
      // Ensure agent file exists for this test suite
      const fs = await import('fs/promises');
      const path = await import('path');

      // Ensure .townhall/agents directory exists
      await fs.mkdir('.townhall/agents', { recursive: true });

      // Create a test agent file
      const agentId = 'f05482e4-324d-4b50-8be3-a49f870cd968';
      const agentContent = `---
id: ${agentId}
name: Test Agent
type: llm
capabilities: [debate, reasoning, analysis]
---

# Test Agent

A test agent for contract testing.`;

      await fs.writeFile(
        path.join('.townhall', 'agents', `${agentId}.md`),
        agentContent,
        'utf8'
      );
    });

    it('should return argument details on success', async () => {
      const agentId = 'f05482e4-324d-4b50-8be3-a49f870cd968';

      // Initialize debate first
      await commandBus.execute(
        { topic: 'Test debate' },
        'InitializeDebateCommand'
      );

      const command: CreateArgumentCommand = {
        agentId,
        type: 'deductive',
        content: {
          text: 'Test argument',
          structure: {
            premises: ['Premise 1', 'Premise 2'],
            conclusion: 'Conclusion'
          }
        }
      };

      const result = await commandBus.execute(command, 'CreateArgumentCommand');

      // Debug output to see the actual error
      if (result.isErr()) {
        console.error('CreateArgumentCommand failed:', result.error);
      }

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveProperty('argumentId');
        expect(result.value).toHaveProperty('shortHash');
        expect(result.value).toHaveProperty('sequenceNumber');
        expect(result.value).toHaveProperty('timestamp');
      }
    });

    it('should require active debate', async () => {
      const command: CreateArgumentCommand = {
        agentId: 'f05482e4-324d-4b50-8be3-a49f870cd968',
        type: 'deductive',
        content: {
          text: 'Test argument',
          structure: {
            premises: ['Premise 1', 'Premise 2'],
            conclusion: 'Conclusion'
          }
        }
      };

      const result = await commandBus.execute(command, 'CreateArgumentCommand');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('No active debate found');
      }
    });
  });

  describe('GetDebateHistoryQuery', () => {
    it('should return debate history', async () => {
      // Create a debate first
      await commandBus.execute(
        { topic: 'Test debate for history' },
        'InitializeDebateCommand'
      );

      const query: GetDebateHistoryQuery = {
        includeRelationships: false
      };

      const result = await queryBus.execute(query, 'GetDebateHistoryQuery');

      // Debug output
      if (result.isErr()) {
        console.error('GetDebateHistoryQuery failed:', result.error);
      }

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveProperty('simulationId');
        expect(result.value).toHaveProperty('topic');
        expect(result.value).toHaveProperty('status');
        expect(result.value).toHaveProperty('arguments');
        expect(result.value).toHaveProperty('participantCount');
        expect(result.value).toHaveProperty('argumentCount');
        expect(Array.isArray(result.value.arguments)).toBe(true);
      }
    });

    it('should handle empty debate gracefully', async () => {
      const query: GetDebateHistoryQuery = {};

      const result = await queryBus.execute(query, 'GetDebateHistoryQuery');

      // Debug output
      if (result.isErr()) {
        console.error('GetDebateHistoryQuery (empty) failed:', result.error);
      }

      // Should succeed even with no active debate
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.arguments).toEqual([]);
      }
    });
  });
});
