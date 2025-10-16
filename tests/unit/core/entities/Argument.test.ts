/**
 * Tests for Argument entity
 * Following TDD approach - these tests will fail until entity is implemented
 */

import { describe, it, expect } from 'vitest';
import { Argument } from '../../../../src/core/entities/Argument';
import { ArgumentType } from '../../../../src/core/value-objects/ArgumentType';
import { ArgumentIdGenerator } from '../../../../src/core/value-objects/ArgumentId';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { expectOk, expectErr } from '../../../helpers/result-assertions';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('Argument Entity', () => {
  const cryptoService = new MockCryptoService();
  const mockAgentId = AgentIdGenerator.generate(cryptoService);
  const mockSimulationId = SimulationIdGenerator.fromTopicAndTimestamp('test', '2025-01-26T10:00:00.000Z');
  const mockTimestamp = TimestampGenerator.now();

  describe('Factory method', () => {
    it('should create deductive argument with valid structure', () => {
      const content = {
        text: 'All humans are mortal. Socrates is human. Therefore, Socrates is mortal.',
        structure: {
          premises: ['All humans are mortal', 'Socrates is human'],
          conclusion: 'Socrates is mortal',
        },
      };

      const argument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      expect(argument).toBeDefined();
      expect(argument.agentId).toBe(mockAgentId);
      expect(argument.type).toBe(ArgumentType.DEDUCTIVE);
      expect(argument.content).toEqual(content);
      expect(argument.simulationId).toBe(mockSimulationId);
      expect(argument.timestamp).toBe(mockTimestamp);
      expect(argument.id).toBeDefined();
    });

    it('should create inductive argument with valid structure', () => {
      const content = {
        text: 'Swan 1 is white. Swan 2 is white. Therefore, all swans are white.',
        structure: {
          observations: ['Swan 1 is white', 'Swan 2 is white'],
          generalization: 'All swans are white',
          confidence: 0.8,
        },
      };

      const argument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.INDUCTIVE,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      expect(argument).toBeDefined();
      expect(argument.type).toBe(ArgumentType.INDUCTIVE);
      expect(argument.content.structure).toHaveProperty('observations');
      expect(argument.content.structure).toHaveProperty('generalization');
    });

    it('should create empirical argument with valid structure', () => {
      const content = {
        text: 'Studies show 90% improvement with this method.',
        structure: {
          evidence: [
            {
              source: 'Study A',
              citation: 'Journal of Science, 2025',
              relevance: 'Direct measurement of improvement',
            },
          ],
          claim: 'This method is 90% effective',
          methodology: 'Randomized controlled trial',
        },
      };

      const argument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.EMPIRICAL,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      expect(argument).toBeDefined();
      expect(argument.type).toBe(ArgumentType.EMPIRICAL);
      expect(argument.content.structure).toHaveProperty('evidence');
      expect(argument.content.structure).toHaveProperty('claim');
    });

    it('should return error for invalid deductive structure', () => {
      const content = {
        text: 'Invalid deductive argument',
        structure: {
          premises: ['Only one premise'], // Should require at least 2
          conclusion: 'Invalid conclusion',
        },
      };

      const error = expectErr(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      expect(error.message).toBe('Deductive arguments require at least 2 premises');
    });

    it('should generate consistent content-addressed ID', () => {
      const content = {
        text: 'Test argument',
        structure: {
          premises: ['Premise 1', 'Premise 2'],
          conclusion: 'Conclusion',
        },
      };

      const argument1 = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      const argument2 = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      expect(argument1.id).toBe(argument2.id);
    });
  });

  describe('Immutability', () => {
    it('should create immutable argument', () => {
      const content = {
        text: 'Test argument',
        structure: {
          premises: ['Premise 1', 'Premise 2'],
          conclusion: 'Conclusion',
        },
      };

      const argument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      // These should not be modifiable
      expect(() => {
        (argument as any).id = 'new-id';
      }).toThrow();

      expect(() => {
        (argument as any).agentId = 'new-agent';
      }).toThrow();
    });
  });

  describe('Metadata', () => {
    it('should include proper metadata', () => {
      const content = {
        text: 'Test argument',
        structure: {
          premises: ['Premise 1', 'Premise 2'],
          conclusion: 'Conclusion',
        },
      };

      const argument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      expect(argument.metadata).toBeDefined();
      expect(argument.metadata.hash).toBe(argument.id);
      expect(argument.metadata.shortHash).toBe(argument.id.slice(0, 7));
      expect(typeof argument.metadata.sequenceNumber).toBe('number');
    });
  });
});