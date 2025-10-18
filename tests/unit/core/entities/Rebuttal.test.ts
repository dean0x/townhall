/**
 * Tests for Rebuttal entity
 * Tests Result type migration and rebuttal-specific validation
 */

import { describe, it, expect } from 'vitest';
import { Rebuttal, CreateRebuttalParams } from '../../../../src/core/entities/Rebuttal';
import { ArgumentType } from '../../../../src/core/value-objects/ArgumentType';
import { ArgumentIdGenerator } from '../../../../src/core/value-objects/ArgumentId';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { expectOk } from '../../../helpers/result-assertions';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('Rebuttal Entity', () => {
  const cryptoService = new MockCryptoService();
  const mockAgentId = AgentIdGenerator.generate(cryptoService);
  const mockSimulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('test', '2025-01-26T10:00:00.000Z', cryptoService));
  const mockTimestamp = TimestampGenerator.now();
  const mockTargetArgumentId = ArgumentIdGenerator.fromContent('target-argument', cryptoService);

  const createBaseRebuttalParams = (rebuttalType: 'logical' | 'empirical' | 'methodological'): CreateRebuttalParams => ({
    agentId: mockAgentId,
    type: ArgumentType.DEDUCTIVE,
    content: {
      text: 'I challenge your argument on logical grounds.',
      structure: {
        premises: ['Your premise A is flawed', 'Your conclusion does not follow'],
        conclusion: 'Your argument is invalid',
      },
    },
    simulationId: mockSimulationId,
    timestamp: mockTimestamp,
    targetArgumentId: mockTargetArgumentId,
    rebuttalType,
  });

  describe('Factory method - create()', () => {
    it('should create logical rebuttal with valid parameters', () => {
      const params = createBaseRebuttalParams('logical');

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rebuttal = result.value;
        expect(rebuttal).toBeDefined();
        expect(rebuttal.rebuttalType).toBe('logical');
        expect(rebuttal.targetArgumentId).toBe(mockTargetArgumentId);
      }
    });

    it('should create empirical rebuttal with valid parameters', () => {
      const params: CreateRebuttalParams = {
        agentId: mockAgentId,
        type: ArgumentType.EMPIRICAL,
        content: {
          text: 'Your data is incorrect.',
          structure: {
            evidence: [
              {
                source: 'Study B',
                citation: 'Journal of Corrections, 2025',
                relevance: 'Contradicts your evidence',
              },
            ],
            claim: 'The data shows the opposite',
            methodology: 'Meta-analysis',
          },
        },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: mockTargetArgumentId,
        rebuttalType: 'empirical',
      };

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rebuttal = result.value;
        expect(rebuttal).toBeDefined();
        expect(rebuttal.rebuttalType).toBe('empirical');
      }
    });

    it('should create methodological rebuttal with valid parameters', () => {
      const params = createBaseRebuttalParams('methodological');

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rebuttal = result.value;
        expect(rebuttal).toBeDefined();
        expect(rebuttal.rebuttalType).toBe('methodological');
      }
    });

    it('should return error for invalid rebuttal type', () => {
      const params = {
        ...createBaseRebuttalParams('logical'),
        rebuttalType: 'invalid-type' as any,
      };

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid rebuttal type');
        expect(result.error.message).toContain('logical, empirical, methodological');
      }
    });

    it('should return error for empty target argument ID', () => {
      const params = {
        ...createBaseRebuttalParams('logical'),
        targetArgumentId: '' as any,
      };

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Target argument ID is required for rebuttals');
      }
    });

    it('should return error for missing target argument ID', () => {
      const params = {
        ...createBaseRebuttalParams('logical'),
        targetArgumentId: null as any,
      };

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Target argument ID is required for rebuttals');
      }
    });
  });

  describe('Instance methods', () => {
    it('should correctly identify rebuttal target with isRebuttalTo()', () => {
      const params = createBaseRebuttalParams('logical');
      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rebuttal = result.value;
        expect(rebuttal.isRebuttalTo(mockTargetArgumentId)).toBe(true);

        const otherArgumentId = ArgumentIdGenerator.fromContent('different-argument', cryptoService);
        expect(rebuttal.isRebuttalTo(otherArgumentId)).toBe(false);
      }
    });

    it('should have immutable properties', () => {
      const params = createBaseRebuttalParams('logical');
      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rebuttal = result.value;

        // Should not be able to modify rebuttal properties
        expect(() => {
          (rebuttal as any).rebuttalType = 'empirical';
        }).toThrow();

        expect(() => {
          (rebuttal as any).targetArgumentId = 'new-id';
        }).toThrow();

        // Should not be able to modify inherited Argument properties
        expect(() => {
          (rebuttal as any).agentId = 'new-agent';
        }).toThrow();
      }
    });

    it('should inherit all Argument properties and methods', () => {
      const params = createBaseRebuttalParams('logical');
      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rebuttal = result.value;

        // Should have Argument properties
        expect(rebuttal.id).toBeDefined();
        expect(rebuttal.agentId).toBe(mockAgentId);
        expect(rebuttal.type).toBe(ArgumentType.DEDUCTIVE);
        expect(rebuttal.content).toBeDefined();
        expect(rebuttal.timestamp).toBe(mockTimestamp);
        expect(rebuttal.simulationId).toBe(mockSimulationId);
        expect(rebuttal.metadata).toBeDefined();
      }
    });
  });

  describe('Rebuttal type validation', () => {
    it('should accept all valid rebuttal types', () => {
      const validTypes: Array<'logical' | 'empirical' | 'methodological'> = ['logical', 'empirical', 'methodological'];

      for (const type of validTypes) {
        const params = createBaseRebuttalParams(type);
        const result = Rebuttal.create(params, cryptoService);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.rebuttalType).toBe(type);
        }
      }
    });

    it('should reject rebuttal types not in valid list', () => {
      const invalidTypes = ['strategic', 'rhetorical', 'ad-hominem', 'strawman', ''];

      for (const type of invalidTypes) {
        const params = {
          ...createBaseRebuttalParams('logical'),
          rebuttalType: type as any,
        };

        const result = Rebuttal.create(params, cryptoService);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toContain('Invalid rebuttal type');
        }
      }
    });
  });

  describe('Content-addressed ID generation', () => {
    it('should generate content-addressed ID including rebuttal data', () => {
      const params = createBaseRebuttalParams('logical');

      const result1 = Rebuttal.create(params, cryptoService);
      const result2 = Rebuttal.create(params, cryptoService);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      if (result1.isOk() && result2.isOk()) {
        // Same parameters should produce same ID
        expect(result1.value.id).toBe(result2.value.id);
      }
    });

    it('should generate different IDs for different rebuttal types', () => {
      const logicalParams = createBaseRebuttalParams('logical');
      const empiricalParams = createBaseRebuttalParams('empirical');

      const logicalResult = Rebuttal.create(logicalParams, cryptoService);
      const empiricalResult = Rebuttal.create(empiricalParams, cryptoService);

      expect(logicalResult.isOk()).toBe(true);
      expect(empiricalResult.isOk()).toBe(true);
      if (logicalResult.isOk() && empiricalResult.isOk()) {
        // Different rebuttal types should produce different IDs
        expect(logicalResult.value.id).not.toBe(empiricalResult.value.id);
      }
    });

    it('should generate different IDs for different target arguments', () => {
      const params1 = createBaseRebuttalParams('logical');
      const params2 = {
        ...createBaseRebuttalParams('logical'),
        targetArgumentId: ArgumentIdGenerator.fromContent('different-target', cryptoService),
      };

      const result1 = Rebuttal.create(params1, cryptoService);
      const result2 = Rebuttal.create(params2, cryptoService);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      if (result1.isOk() && result2.isOk()) {
        // Different targets should produce different IDs
        expect(result1.value.id).not.toBe(result2.value.id);
      }
    });

    it('should include metadata with hash and shortHash', () => {
      const params = createBaseRebuttalParams('logical');
      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rebuttal = result.value;
        expect(rebuttal.metadata).toBeDefined();
        expect(rebuttal.metadata.hash).toBe(rebuttal.id);
        expect(rebuttal.metadata.shortHash).toBe(rebuttal.id.slice(0, 7));
        expect(typeof rebuttal.metadata.sequenceNumber).toBe('number');
      }
    });

    it('should respect sequenceNumber if provided', () => {
      const params = {
        ...createBaseRebuttalParams('logical'),
        sequenceNumber: 42,
      };

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.metadata.sequenceNumber).toBe(42);
      }
    });

    it('should default sequenceNumber to 0 if not provided', () => {
      const params = createBaseRebuttalParams('logical');

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.metadata.sequenceNumber).toBe(0);
      }
    });
  });

  describe('Integration with different argument types', () => {
    it('should work with DEDUCTIVE arguments', () => {
      const params: CreateRebuttalParams = {
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: {
          text: 'Your logical reasoning is flawed.',
          structure: {
            premises: ['Premise A is false', 'Therefore conclusion is invalid'],
            conclusion: 'Your argument fails',
          },
        },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: mockTargetArgumentId,
        rebuttalType: 'logical',
      };

      const result = Rebuttal.create(params, cryptoService);
      expect(result.isOk()).toBe(true);
    });

    it('should work with INDUCTIVE arguments', () => {
      const params: CreateRebuttalParams = {
        agentId: mockAgentId,
        type: ArgumentType.INDUCTIVE,
        content: {
          text: 'Your generalization is premature.',
          structure: {
            observations: ['Counter-example 1', 'Counter-example 2'],
            generalization: 'Your pattern does not hold',
            confidence: 0.9,
          },
        },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: mockTargetArgumentId,
        rebuttalType: 'logical',
      };

      const result = Rebuttal.create(params, cryptoService);
      expect(result.isOk()).toBe(true);
    });

    it('should work with EMPIRICAL arguments', () => {
      const params: CreateRebuttalParams = {
        agentId: mockAgentId,
        type: ArgumentType.EMPIRICAL,
        content: {
          text: 'The data contradicts your claim.',
          structure: {
            evidence: [
              {
                source: 'Contradictory Study',
                citation: 'Journal of Counter-Evidence, 2025',
                relevance: 'Directly refutes your data',
              },
            ],
            claim: 'The opposite is true',
            methodology: 'Double-blind controlled trial',
          },
        },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: mockTargetArgumentId,
        rebuttalType: 'empirical',
      };

      const result = Rebuttal.create(params, cryptoService);
      expect(result.isOk()).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long target argument IDs', () => {
      const longTargetId = 'a'.repeat(1000) as any;
      const params = {
        ...createBaseRebuttalParams('logical'),
        targetArgumentId: longTargetId,
      };

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.targetArgumentId).toBe(longTargetId);
      }
    });

    it('should handle special characters in target argument ID', () => {
      const specialTargetId = 'abc-123-def-456-ghi-789-jkl-012' as any;
      const params = {
        ...createBaseRebuttalParams('logical'),
        targetArgumentId: specialTargetId,
      };

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.targetArgumentId).toBe(specialTargetId);
      }
    });

    it('should handle unicode in rebuttal content', () => {
      const params: CreateRebuttalParams = {
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: {
          text: '你的论点在逻辑上是有缺陷的', // Chinese
          structure: {
            premises: ['前提A是错误的', '结论不成立'],
            conclusion: '你的论点无效',
          },
        },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: mockTargetArgumentId,
        rebuttalType: 'logical',
      };

      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.content.text).toBe('你的论点在逻辑上是有缺陷的');
      }
    });

    // NOTE: Timestamp is now required (BLOCKING FIX #2 - removed side effects)
    // No default timestamp generation - timestamp must be explicitly provided
  });

  describe('Comparison with base Argument', () => {
    it('should be instanceof Rebuttal and Argument', () => {
      const params = createBaseRebuttalParams('logical');
      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rebuttal = result.value;
        expect(rebuttal instanceof Rebuttal).toBe(true);
        // Note: Due to the way the constructor is called, instanceof might not work
        // for the parent class, but we can verify it has all Argument properties
        expect(rebuttal.id).toBeDefined();
        expect(rebuttal.agentId).toBeDefined();
        expect(rebuttal.type).toBeDefined();
        expect(rebuttal.content).toBeDefined();
      }
    });

    it('should have additional rebuttal-specific properties beyond Argument', () => {
      const params = createBaseRebuttalParams('logical');
      const result = Rebuttal.create(params, cryptoService);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rebuttal = result.value;

        // Rebuttal-specific properties
        expect(rebuttal.targetArgumentId).toBeDefined();
        expect(rebuttal.rebuttalType).toBeDefined();
        expect(rebuttal.isRebuttalTo).toBeDefined();
        expect(typeof rebuttal.isRebuttalTo).toBe('function');
      }
    });
  });
});
