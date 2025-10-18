/**
 * Tests for RelationshipBuilder
 * Following TDD approach
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipBuilder } from '../../../../src/core/services/RelationshipBuilder';
import { ICryptoService } from '../../../../src/core/services/ICryptoService';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { expectOk } from '../../../helpers/result-assertions';
import { Argument } from '../../../../src/core/entities/Argument';
import { Rebuttal } from '../../../../src/core/entities/Rebuttal';
import { Concession } from '../../../../src/core/entities/Concession';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';

describe('RelationshipBuilder', () => {
  let builder: RelationshipBuilder;
  let cryptoService: ICryptoService;

  beforeEach(() => {
    builder = new RelationshipBuilder();
    cryptoService = new MockCryptoService();
  });

  describe('createRebuttalRelationship', () => {
    it('should create rebuttal relationship successfully', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId: agentId1,
        type: 'deductive',
        content: {
          text: 'Original argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const rebuttal = expectOk(Rebuttal.create({
        agentId: agentId2,
        type: 'deductive',
        content: {
          text: 'Rebuttal text.',
          structure: {
            premises: ['P1 is false', 'Therefore C is false'],
            conclusion: 'Original is flawed',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createRebuttalRelationship(rebuttal, targetArgument);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.fromId).toBe(rebuttal.id);
        expect(result.value.toId).toBe(targetArgument.id);
        expect(result.value.type).toBe('rebuts');
        expect(result.value.strength).toBeDefined();
        expect(result.value.strength).toBeGreaterThanOrEqual(0);
        expect(result.value.strength).toBeLessThanOrEqual(1);
      }
    });

    it('should calculate higher strength for logical rebuttal of deductive argument', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId: agentId1,
        type: 'deductive',
        content: {
          text: 'Original argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const rebuttal = expectOk(Rebuttal.create({
        agentId: agentId2,
        type: 'deductive',
        content: {
          text: 'Rebuttal text.',
          structure: {
            premises: ['P1 is false', 'Therefore C is false'],
            conclusion: 'Original is flawed',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createRebuttalRelationship(rebuttal, targetArgument);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.strength).toBeGreaterThan(0.5); // Base + logical bonus
      }
    });

    it('should calculate higher strength for empirical rebuttal of empirical argument', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId: agentId1,
        type: 'empirical',
        content: {
          text: 'Original empirical argument.',
          structure: {
            claim: 'Test claim',
            evidence: [
              { source: 'Study A', relevance: 'Shows correlation' }
            ],
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const rebuttal = expectOk(Rebuttal.create({
        agentId: agentId2,
        type: 'empirical',
        content: {
          text: 'Counter-evidence.',
          structure: {
            claim: 'Counter claim',
            evidence: [
              { source: 'Study B', relevance: 'Shows opposite' }
            ],
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        rebuttalType: 'empirical',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createRebuttalRelationship(rebuttal, targetArgument);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.strength).toBeGreaterThan(0.5); // Base + empirical bonus
      }
    });

    it('should fail when agent rebuts own argument', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId, // Same agent
        type: 'deductive',
        content: {
          text: 'Original argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const rebuttal = expectOk(Rebuttal.create({
        agentId, // Same agent!
        type: 'deductive',
        content: {
          text: 'Rebuttal text.',
          structure: {
            premises: ['P1 is false', 'Therefore C is false'],
            conclusion: 'Original is flawed',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createRebuttalRelationship(rebuttal, targetArgument);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('cannot rebut their own arguments');
      }
    });

    it('should fail when rebuttal targets different simulation', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const simulationId1 = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test1', TimestampGenerator.now(), cryptoService));
      const simulationId2 = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test2', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId: agentId1,
        type: 'deductive',
        content: {
          text: 'Original argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulationId1, // Simulation 1
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const rebuttal = expectOk(Rebuttal.create({
        agentId: agentId2,
        type: 'deductive',
        content: {
          text: 'Rebuttal text.',
          structure: {
            premises: ['P1 is false', 'Therefore C is false'],
            conclusion: 'Original is flawed',
          },
        },
        simulationId: simulationId2, // Simulation 2 - different!
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createRebuttalRelationship(rebuttal, targetArgument);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('same simulation');
      }
    });
  });

  describe('createConcessionRelationship', () => {
    it('should create full concession relationship', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId: agentId1,
        type: 'deductive',
        content: {
          text: 'Original argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const concession = expectOk(Concession.create({
        agentId: agentId2,
        type: 'deductive',
        content: {
          text: 'I concede.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createConcessionRelationship(concession, targetArgument);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.fromId).toBe(concession.id);
        expect(result.value.toId).toBe(targetArgument.id);
        expect(result.value.type).toBe('concedes_to');
        expect(result.value.strength).toBe(1.0); // Full concession = 1.0
      }
    });

    it('should calculate correct strength for partial concession', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId: agentId1,
        type: 'deductive',
        content: {
          text: 'Original argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const concession = expectOk(Concession.create({
        agentId: agentId2,
        type: 'deductive',
        content: {
          text: 'I partially concede.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        concessionType: 'partial',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createConcessionRelationship(concession, targetArgument);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.strength).toBe(0.6); // Partial concession = 0.6
      }
    });

    it('should calculate correct strength for conditional concession', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId: agentId1,
        type: 'deductive',
        content: {
          text: 'Original argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const concession = expectOk(Concession.create({
        agentId: agentId2,
        type: 'deductive',
        content: {
          text: 'I conditionally concede.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        concessionType: 'conditional',
        conditions: 'If additional evidence is provided',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createConcessionRelationship(concession, targetArgument);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.strength).toBe(0.4); // Conditional concession = 0.4
      }
    });

    it('should fail when agent concedes to own argument', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId, // Same agent
        type: 'deductive',
        content: {
          text: 'Original argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const concession = expectOk(Concession.create({
        agentId, // Same agent!
        type: 'deductive',
        content: {
          text: 'I concede.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createConcessionRelationship(concession, targetArgument);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('cannot concede to their own arguments');
      }
    });

    it('should fail when concession targets different simulation', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const simulationId1 = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test1', TimestampGenerator.now(), cryptoService));
      const simulationId2 = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test2', TimestampGenerator.now(), cryptoService));

      const targetArgument = expectOk(Argument.create({
        agentId: agentId1,
        type: 'deductive',
        content: {
          text: 'Original argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulationId1, // Simulation 1
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const concession = expectOk(Concession.create({
        agentId: agentId2,
        type: 'deductive',
        content: {
          text: 'I concede.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulationId2, // Simulation 2 - different!
        timestamp: TimestampGenerator.now(),
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
        sequenceNumber: 2,
      }, cryptoService));

      const result = builder.createConcessionRelationship(concession, targetArgument);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('same simulation');
      }
    });
  });

  describe('buildChain', () => {
    it('should build empty chain for argument with no relationships', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const rootArgument = expectOk(Argument.create({
        agentId,
        type: 'deductive',
        content: {
          text: 'Root argument.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const chain = builder.buildChain(rootArgument, [rootArgument], []);

      expect(chain.root).toBe(rootArgument);
      expect(chain.relationships).toHaveLength(0);
      expect(chain.depth).toBe(0);
    });

    it('should build chain with single relationship', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const arg1 = expectOk(Argument.create({
        agentId: agentId1,
        type: 'deductive',
        content: {
          text: 'Argument 1.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const arg2 = expectOk(Argument.create({
        agentId: agentId2,
        type: 'deductive',
        content: {
          text: 'Argument 2.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 2,
      }, cryptoService));

      const relationships = [
        {
          fromId: arg1.id,
          toId: arg2.id,
          type: 'rebuts' as const,
          strength: 0.7,
        },
      ];

      const chain = builder.buildChain(arg1, [arg1, arg2], relationships);

      expect(chain.relationships).toHaveLength(1);
      expect(chain.depth).toBe(1);
    });

    it('should calculate correct depth for multi-level chain', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

      const arg1 = expectOk(Argument.create({
        agentId,
        type: 'deductive',
        content: {
          text: 'Argument 1.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const arg2 = expectOk(Argument.create({
        agentId,
        type: 'deductive',
        content: {
          text: 'Argument 2.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 2,
      }, cryptoService));

      const arg3 = expectOk(Argument.create({
        agentId,
        type: 'deductive',
        content: {
          text: 'Argument 3.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 3,
      }, cryptoService));

      // Chain: arg1 -> arg2 -> arg3
      const relationships = [
        {
          fromId: arg1.id,
          toId: arg2.id,
          type: 'rebuts' as const,
          strength: 0.7,
        },
        {
          fromId: arg2.id,
          toId: arg3.id,
          type: 'rebuts' as const,
          strength: 0.6,
        },
      ];

      const chain = builder.buildChain(arg1, [arg1, arg2, arg3], relationships);

      expect(chain.relationships).toHaveLength(2);
      expect(chain.depth).toBe(2);
    });
  });

  describe('findDirectRelationships', () => {
    it('should find all direct relationships for an argument', () => {
      const arg1Id = 'arg1' as any;
      const arg2Id = 'arg2' as any;
      const arg3Id = 'arg3' as any;

      const relationships = [
        { fromId: arg1Id, toId: arg2Id, type: 'rebuts' as const, strength: 0.7 },
        { fromId: arg2Id, toId: arg3Id, type: 'rebuts' as const, strength: 0.6 },
        { fromId: arg1Id, toId: arg3Id, type: 'supports' as const, strength: 0.8 },
      ];

      const direct = builder.findDirectRelationships(arg1Id, relationships);

      expect(direct).toHaveLength(2);
      expect(direct.every(r => r.fromId === arg1Id || r.toId === arg1Id)).toBe(true);
    });
  });

  describe('findRebuttalTargets', () => {
    it('should find all rebuttals targeting an argument', () => {
      const arg1Id = 'arg1' as any;
      const arg2Id = 'arg2' as any;
      const arg3Id = 'arg3' as any;

      const relationships = [
        { fromId: arg2Id, toId: arg1Id, type: 'rebuts' as const, strength: 0.7 },
        { fromId: arg3Id, toId: arg1Id, type: 'rebuts' as const, strength: 0.6 },
        { fromId: arg1Id, toId: arg2Id, type: 'concedes_to' as const, strength: 0.8 },
      ];

      const rebuttals = builder.findRebuttalTargets(arg1Id, relationships);

      expect(rebuttals).toHaveLength(2);
      expect(rebuttals).toContain(arg2Id);
      expect(rebuttals).toContain(arg3Id);
    });
  });

  describe('findConcessionTargets', () => {
    it('should find all concessions targeting an argument', () => {
      const arg1Id = 'arg1' as any;
      const arg2Id = 'arg2' as any;
      const arg3Id = 'arg3' as any;

      const relationships = [
        { fromId: arg2Id, toId: arg1Id, type: 'concedes_to' as const, strength: 1.0 },
        { fromId: arg3Id, toId: arg1Id, type: 'concedes_to' as const, strength: 0.6 },
        { fromId: arg1Id, toId: arg2Id, type: 'rebuts' as const, strength: 0.7 },
      ];

      const concessions = builder.findConcessionTargets(arg1Id, relationships);

      expect(concessions).toHaveLength(2);
      expect(concessions).toContain(arg2Id);
      expect(concessions).toContain(arg3Id);
    });
  });

  describe('detectCircularReferences', () => {
    it('should pass when no circular references exist', () => {
      const arg1Id = 'arg1' as any;
      const arg2Id = 'arg2' as any;
      const arg3Id = 'arg3' as any;

      // Linear chain: arg1 -> arg2 -> arg3
      const relationships = [
        { fromId: arg1Id, toId: arg2Id, type: 'rebuts' as const, strength: 0.7 },
        { fromId: arg2Id, toId: arg3Id, type: 'rebuts' as const, strength: 0.6 },
      ];

      const result = builder.detectCircularReferences(relationships);

      expect(result.isOk()).toBe(true);
    });

    it('should detect direct circular reference (A -> B -> A)', () => {
      const arg1Id = 'arg1' as any;
      const arg2Id = 'arg2' as any;

      // Circular: arg1 -> arg2 -> arg1
      const relationships = [
        { fromId: arg1Id, toId: arg2Id, type: 'rebuts' as const, strength: 0.7 },
        { fromId: arg2Id, toId: arg1Id, type: 'rebuts' as const, strength: 0.6 },
      ];

      const result = builder.detectCircularReferences(relationships);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Circular reference');
      }
    });

    it('should detect indirect circular reference (A -> B -> C -> A)', () => {
      const arg1Id = 'arg1' as any;
      const arg2Id = 'arg2' as any;
      const arg3Id = 'arg3' as any;

      // Circular: arg1 -> arg2 -> arg3 -> arg1
      const relationships = [
        { fromId: arg1Id, toId: arg2Id, type: 'rebuts' as const, strength: 0.7 },
        { fromId: arg2Id, toId: arg3Id, type: 'rebuts' as const, strength: 0.6 },
        { fromId: arg3Id, toId: arg1Id, type: 'rebuts' as const, strength: 0.5 },
      ];

      const result = builder.detectCircularReferences(relationships);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Circular reference');
      }
    });

    it('should allow branching without circular references', () => {
      const arg1Id = 'arg1' as any;
      const arg2Id = 'arg2' as any;
      const arg3Id = 'arg3' as any;
      const arg4Id = 'arg4' as any;

      // Tree structure: arg1 -> arg2, arg1 -> arg3, arg2 -> arg4
      const relationships = [
        { fromId: arg1Id, toId: arg2Id, type: 'rebuts' as const, strength: 0.7 },
        { fromId: arg1Id, toId: arg3Id, type: 'rebuts' as const, strength: 0.6 },
        { fromId: arg2Id, toId: arg4Id, type: 'rebuts' as const, strength: 0.5 },
      ];

      const result = builder.detectCircularReferences(relationships);

      expect(result.isOk()).toBe(true);
    });
  });
});
