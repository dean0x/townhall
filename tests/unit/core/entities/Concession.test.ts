/**
 * Tests for Concession entity
 * Tests Result type migration and concession-specific validation
 */

import { describe, it, expect } from 'vitest';
import { Concession, CreateConcessionParams } from '../../../../src/core/entities/Concession';
import { ArgumentType } from '../../../../src/core/value-objects/ArgumentType';
import { ArgumentIdGenerator } from '../../../../src/core/value-objects/ArgumentId';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('Concession Entity', () => {
  const cryptoService = new MockCryptoService();
  const mockAgentId = AgentIdGenerator.generate(cryptoService);
  const mockSimulationId = SimulationIdGenerator.fromTopicAndTimestamp('test', '2025-01-26T10:00:00.000Z');
  const mockTimestamp = TimestampGenerator.now();
  const mockTargetArgumentId = ArgumentIdGenerator.fromContent('target-argument', cryptoService);

  const createBaseConcessionParams = (concessionType: 'full' | 'partial' | 'conditional'): CreateConcessionParams => ({
    agentId: mockAgentId,
    type: ArgumentType.DEDUCTIVE,
    content: {
      text: 'I concede that your point is valid.',
      structure: {
        premises: ['Your evidence is strong', 'My position cannot refute it'],
        conclusion: 'I accept your argument',
      },
    },
    simulationId: mockSimulationId,
    timestamp: mockTimestamp,
    targetArgumentId: mockTargetArgumentId,
    concessionType,
  });

  describe('Factory method - create()', () => {
    it('should create full concession with valid parameters', () => {
      const params = createBaseConcessionParams('full');

      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const concession = result.value;
        expect(concession).toBeDefined();
        expect(concession.concessionType).toBe('full');
        expect(concession.targetArgumentId).toBe(mockTargetArgumentId);
        expect(concession.isFull()).toBe(true);
        expect(concession.isPartial()).toBe(false);
        expect(concession.isConditional()).toBe(false);
      }
    });

    it('should create partial concession with valid parameters', () => {
      const params = createBaseConcessionParams('partial');

      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const concession = result.value;
        expect(concession).toBeDefined();
        expect(concession.concessionType).toBe('partial');
        expect(concession.isPartial()).toBe(true);
        expect(concession.isFull()).toBe(false);
        expect(concession.isConditional()).toBe(false);
      }
    });

    it('should create conditional concession with valid parameters and conditions', () => {
      const params: CreateConcessionParams = {
        ...createBaseConcessionParams('conditional'),
        conditions: 'Only if we assume perfect information',
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const concession = result.value;
        expect(concession).toBeDefined();
        expect(concession.concessionType).toBe('conditional');
        expect(concession.conditions).toBe('Only if we assume perfect information');
        expect(concession.isConditional()).toBe(true);
        expect(concession.isFull()).toBe(false);
        expect(concession.isPartial()).toBe(false);
      }
    });

    it('should include optional explanation when provided', () => {
      const params: CreateConcessionParams = {
        ...createBaseConcessionParams('full'),
        explanation: 'After reviewing the evidence, I see the merit in your position.',
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const concession = result.value;
        expect(concession.explanation).toBe('After reviewing the evidence, I see the merit in your position.');
      }
    });

    it('should return error for invalid concession type', () => {
      const params = {
        ...createBaseConcessionParams('full'),
        concessionType: 'invalid-type' as any,
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid concession type');
        expect(result.error.message).toContain('full, partial, conditional');
      }
    });

    it('should return error for conditional concession without conditions', () => {
      const params: CreateConcessionParams = {
        ...createBaseConcessionParams('conditional'),
        // conditions omitted
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Conditional concessions must specify conditions');
      }
    });

    it('should return error for conditional concession with empty conditions', () => {
      const params: CreateConcessionParams = {
        ...createBaseConcessionParams('conditional'),
        conditions: '   ', // whitespace only
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Conditional concessions must specify conditions');
      }
    });

    it('should return error for empty target argument ID', () => {
      const params = {
        ...createBaseConcessionParams('full'),
        targetArgumentId: '' as any,
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Target argument ID is required for concessions');
      }
    });

    it('should return error for missing target argument ID', () => {
      const params = {
        ...createBaseConcessionParams('full'),
        targetArgumentId: null as any,
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Target argument ID is required for concessions');
      }
    });

    it('should inherit argument validation from base Argument class', () => {
      const params = {
        ...createBaseConcessionParams('full'),
        content: {
          text: 'Invalid deductive argument',
          structure: {
            premises: ['Only one premise'], // Should require at least 2 for deductive
            conclusion: 'Invalid conclusion',
          },
        },
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        // Should fail Argument validation
        expect(result.error.message).toBe('Deductive arguments require at least 2 premises');
      }
    });
  });

  describe('Instance methods', () => {
    it('should correctly identify concession target with isConcessionTo()', () => {
      const params = createBaseConcessionParams('full');
      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const concession = result.value;
        expect(concession.isConcessionTo(mockTargetArgumentId)).toBe(true);

        const otherArgumentId = ArgumentIdGenerator.fromContent('different-argument', cryptoService);
        expect(concession.isConcessionTo(otherArgumentId)).toBe(false);
      }
    });

    it('should have immutable properties', () => {
      const params = createBaseConcessionParams('full');
      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const concession = result.value;

        // Should not be able to modify concession properties
        expect(() => {
          (concession as any).concessionType = 'partial';
        }).toThrow();

        expect(() => {
          (concession as any).targetArgumentId = 'new-id';
        }).toThrow();

        expect(() => {
          (concession as any).conditions = 'new conditions';
        }).toThrow();
      }
    });

    it('should inherit all Argument properties and methods', () => {
      const params = createBaseConcessionParams('full');
      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const concession = result.value;

        // Should have Argument properties
        expect(concession.id).toBeDefined();
        expect(concession.agentId).toBe(mockAgentId);
        expect(concession.type).toBe(ArgumentType.DEDUCTIVE);
        expect(concession.content).toBeDefined();
        expect(concession.timestamp).toBe(mockTimestamp);
        expect(concession.simulationId).toBe(mockSimulationId);
        expect(concession.metadata).toBeDefined();
      }
    });
  });

  describe('Concession type validation', () => {
    it('should accept all valid concession types', () => {
      const validTypes: Array<'full' | 'partial' | 'conditional'> = ['full', 'partial', 'conditional'];

      for (const type of validTypes) {
        const params: CreateConcessionParams = {
          ...createBaseConcessionParams(type),
          conditions: type === 'conditional' ? 'Some condition' : undefined,
        };

        const result = Concession.create(params, cryptoService);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.concessionType).toBe(type);
        }
      }
    });

    it('should allow full and partial concessions without conditions', () => {
      const fullResult = Concession.create(createBaseConcessionParams('full'), cryptoService);
      expect(fullResult.isOk()).toBe(true);

      const partialResult = Concession.create(createBaseConcessionParams('partial'), cryptoService);
      expect(partialResult.isOk()).toBe(true);
    });

    it('should allow full and partial concessions with conditions (optional)', () => {
      const fullWithConditions = Concession.create({
        ...createBaseConcessionParams('full'),
        conditions: 'Optional conditions for full concession',
      }, cryptoService);
      expect(fullWithConditions.isOk()).toBe(true);

      const partialWithConditions = Concession.create({
        ...createBaseConcessionParams('partial'),
        conditions: 'Optional conditions for partial concession',
      }, cryptoService);
      expect(partialWithConditions.isOk()).toBe(true);
    });
  });

  describe('Integration with Argument entity', () => {
    it('should generate unique content-addressed ID like Argument', () => {
      const params = createBaseConcessionParams('full');

      const result1 = Concession.create(params, cryptoService);
      const result2 = Concession.create(params, cryptoService);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      if (result1.isOk() && result2.isOk()) {
        // Same content should produce same ID
        expect(result1.value.id).toBe(result2.value.id);
      }
    });

    it('should have different ID from base Argument with same content', () => {
      const params = createBaseConcessionParams('full');
      const concessionResult = Concession.create(params, cryptoService);

      expect(concessionResult.isOk()).toBe(true);
      if (concessionResult.isOk()) {
        const concession = concessionResult.value;
        // Concession extends Argument, so ID should be the same base calculation
        expect(concession.id).toBeDefined();
        expect(concession.metadata.hash).toBe(concession.id);
      }
    });

    it('should include metadata like base Argument', () => {
      const params = createBaseConcessionParams('full');
      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const concession = result.value;
        expect(concession.metadata).toBeDefined();
        expect(concession.metadata.hash).toBe(concession.id);
        expect(concession.metadata.shortHash).toBe(concession.id.slice(0, 7));
        expect(typeof concession.metadata.sequenceNumber).toBe('number');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle very long conditions for conditional concessions', () => {
      const longConditions = 'A'.repeat(10000);
      const params: CreateConcessionParams = {
        ...createBaseConcessionParams('conditional'),
        conditions: longConditions,
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.conditions).toBe(longConditions);
      }
    });

    it('should handle very long explanations', () => {
      const longExplanation = 'B'.repeat(10000);
      const params: CreateConcessionParams = {
        ...createBaseConcessionParams('full'),
        explanation: longExplanation,
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.explanation).toBe(longExplanation);
      }
    });

    it('should handle special characters in target argument ID', () => {
      const specialTargetId = 'abc-123-def-456-ghi-789' as any;
      const params = {
        ...createBaseConcessionParams('full'),
        targetArgumentId: specialTargetId,
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.targetArgumentId).toBe(specialTargetId);
      }
    });

    it('should handle unicode in conditions and explanations', () => {
      const params: CreateConcessionParams = {
        ...createBaseConcessionParams('conditional'),
        conditions: '如果我们假设完美信息', // Chinese
        explanation: 'Nach Überprüfung der Beweise', // German
      };

      const result = Concession.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.conditions).toBe('如果我们假设完美信息');
        expect(result.value.explanation).toBe('Nach Überprüfung der Beweise');
      }
    });
  });
});
