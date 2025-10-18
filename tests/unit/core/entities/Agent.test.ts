/**
 * Tests for Agent entity
 * Following TDD approach - these tests will fail until entity is implemented
 */

import { describe, it, expect } from 'vitest';
import { Agent } from '../../../../src/core/entities/Agent';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { expectOk, expectErr, expectErrMessage } from '../../../helpers/result-assertions';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('Agent Entity', () => {
  const cryptoService = new MockCryptoService();

  describe('Factory method', () => {
    it('should create agent with valid properties', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const agent = expectOk(Agent.create({
        id: agentId,
        name: 'Socrates',
        type: 'human',
        capabilities: ['debate', 'analysis'],
        description: 'A classical philosopher',
        filePath: '.townhall/agents/socrates.md',
      }));

      expect(agent).toBeDefined();
      expect(agent.id).toBe(agentId);
      expect(agent.name).toBe('Socrates');
      expect(agent.type).toBe('human');
      expect(agent.capabilities).toEqual(['debate', 'analysis']);
      expect(agent.description).toBe('A classical philosopher');
      expect(agent.filePath).toBe('.townhall/agents/socrates.md');
    });

    it('should validate agent name length', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const error = expectErr(Agent.create({
        id: agentId,
        name: '', // Empty name should fail
        type: 'human',
        capabilities: ['debate'],
        description: 'A philosopher',
        filePath: '.townhall/agents/test.md',
      }));

      expect(error.message).toBe('Agent name must be between 1 and 100 characters');
    });

    it('should validate agent type', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      expectErrMessage(Agent.create({
        id: agentId,
        name: 'TestAgent',
        type: 'invalid' as any, // Invalid type should fail
        capabilities: ['debate'],
        description: 'A test agent',
        filePath: '.townhall/agents/test.md',
      }), 'Invalid agent type');
    });

    it('should require at least one capability', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const error = expectErr(Agent.create({
        id: agentId,
        name: 'TestAgent',
        type: 'llm',
        capabilities: [], // Empty capabilities should fail
        description: 'A test agent',
        filePath: '.townhall/agents/test.md',
      }));

      expect(error.message).toBe('Agent must have at least one capability');
    });
  });

  describe('Immutability', () => {
    it('should create immutable agent', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const agent = expectOk(Agent.create({
        id: agentId,
        name: 'TestAgent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'A test agent',
        filePath: '.townhall/agents/test.md',
      }));

      // These should not be modifiable
      expect(() => {
        (agent as any).id = 'new-id';
      }).toThrow();

      expect(() => {
        (agent as any).name = 'NewName';
      }).toThrow();
    });
  });

  describe('Agent types', () => {
    it('should accept valid agent types', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const validTypes = ['human', 'llm', 'hybrid'] as const;

      validTypes.forEach(type => {
        const agent = expectOk(Agent.create({
          id: agentId,
          name: 'TestAgent',
          type,
          capabilities: ['debate'],
          description: 'A test agent',
          filePath: '.townhall/agents/test.md',
        }));

        expect(agent.type).toBe(type);
      });
    });
  });

  describe('Capabilities validation', () => {
    it('should accept valid capabilities', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const validCapabilities = [
        ['debate'],
        ['analysis'],
        ['debate', 'analysis'],
        ['debate', 'analysis', 'reasoning'],
      ];

      validCapabilities.forEach(capabilities => {
        const agent = expectOk(Agent.create({
          id: agentId,
          name: 'TestAgent',
          type: 'llm',
          capabilities,
          description: 'A test agent',
          filePath: '.townhall/agents/test.md',
        }));

        expect(agent.capabilities).toEqual(capabilities);
      });
    });
  });
});
