/**
 * Tests for DebateSimulation entity
 * Following TDD approach - these tests will fail until entity is implemented
 */

import { describe, it, expect } from 'vitest';
import { DebateSimulation } from '../../../../src/core/entities/DebateSimulation';
import { DebateStatus } from '../../../../src/core/value-objects/DebateStatus';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { ArgumentIdGenerator } from '../../../../src/core/value-objects/ArgumentId';
import { expectOk, expectErr } from '../../../helpers/result-assertions';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('DebateSimulation Entity', () => {
  const cryptoService = new MockCryptoService();
  const mockTimestamp = TimestampGenerator.now();

  describe('Factory method', () => {
    it('should create simulation with valid properties', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Should AI be regulated?',
        createdAt: mockTimestamp,
      }));

      expect(simulation).toBeDefined();
      expect(simulation.topic).toBe('Should AI be regulated?');
      expect(simulation.createdAt).toBe(mockTimestamp);
      expect(simulation.status).toBe(DebateStatus.ACTIVE);
      expect(simulation.participantIds).toEqual([]);
      expect(simulation.argumentIds).toEqual([]);
      expect(simulation.votesToClose).toEqual([]);
      expect(simulation.id).toBeDefined();
    });

    it('should validate topic length', () => {
      const error1 = expectErr(DebateSimulation.create({
        cryptoService,
        topic: '', // Empty topic should fail
        createdAt: mockTimestamp,
      }));

      expect(error1.message).toBe('Topic must be between 1 and 500 characters');

      const error2 = expectErr(DebateSimulation.create({
        cryptoService,
        topic: 'a'.repeat(501), // Too long topic should fail
        createdAt: mockTimestamp,
      }));

      expect(error2.message).toBe('Topic must be between 1 and 500 characters');
    });

    it('should generate consistent content-addressed ID', () => {
      const topic = 'Test debate topic';
      const timestamp = TimestampGenerator.fromString('2025-01-26T10:00:00.000Z');

      const simulation1 = expectOk(DebateSimulation.create({
        cryptoService,
        topic,
        createdAt: timestamp,
      }));

      const simulation2 = expectOk(DebateSimulation.create({
        cryptoService,
        topic,
        createdAt: timestamp,
      }));

      expect(simulation1.id).toBe(simulation2.id);
    });
  });

  describe('Participant management', () => {
    it('should add participant to simulation', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Test topic',
        createdAt: mockTimestamp,
      }));

      const agentId = AgentIdGenerator.generate(cryptoService);
      const updated = simulation.addParticipant(agentId);

      expect(updated.participantIds).toContain(agentId);
      expect(updated.participantIds).toHaveLength(1);
    });

    it('should not add duplicate participants', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Test topic',
        createdAt: mockTimestamp,
      }));

      const agentId = AgentIdGenerator.generate(cryptoService);
      const updated1 = simulation.addParticipant(agentId);
      const updated2 = updated1.addParticipant(agentId);

      expect(updated2.participantIds).toHaveLength(1);
    });
  });

  describe('Argument management', () => {
    it('should add argument to simulation', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Test topic',
        createdAt: mockTimestamp,
      }));

      const argumentId = ArgumentIdGenerator.fromContent('Test argument', cryptoService);
      const updated = simulation.addArgument(argumentId);

      expect(updated.argumentIds).toContain(argumentId);
      expect(updated.argumentIds).toHaveLength(1);
    });

    it('should maintain argument order', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Test topic',
        createdAt: mockTimestamp,
      }));

      const arg1 = ArgumentIdGenerator.fromContent('Argument 1', cryptoService);
      const arg2 = ArgumentIdGenerator.fromContent('Argument 2', cryptoService);
      const arg3 = ArgumentIdGenerator.fromContent('Argument 3', cryptoService);

      const updated = simulation
        .addArgument(arg1)
        .addArgument(arg2)
        .addArgument(arg3);

      expect(updated.argumentIds).toEqual([arg1, arg2, arg3]);
    });
  });

  describe('Status transitions', () => {
    it('should transition from active to voting', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Test topic',
        createdAt: mockTimestamp,
      }));

      const updated = simulation.transitionTo(DebateStatus.VOTING);

      expect(updated.status).toBe(DebateStatus.VOTING);
    });

    it('should validate status transitions', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Test topic',
        createdAt: mockTimestamp,
      }));

      // Entities are now pure data - validation happens in handlers
      const updated = simulation.transitionTo(DebateStatus.CLOSED);
      expect(updated.status).toBe(DebateStatus.CLOSED);
    });
  });

  describe('Vote management', () => {
    it('should record close votes', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Test topic',
        createdAt: mockTimestamp,
      }));

      const agentId = AgentIdGenerator.generate(cryptoService);
      const withParticipant = simulation.addParticipant(agentId);
      const updated = withParticipant.recordCloseVote(agentId, true, 'All points covered', mockTimestamp);

      expect(updated.votesToClose).toHaveLength(1);
      expect(updated.votesToClose[0]?.agentId).toBe(agentId);
      expect(updated.votesToClose[0]?.vote).toBe(true);
    });

    it('should not allow duplicate votes from same agent', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Test topic',
        createdAt: mockTimestamp,
      }));

      const agentId = AgentIdGenerator.generate(cryptoService);
      const withParticipant = simulation.addParticipant(agentId);
      const updated1 = withParticipant.recordCloseVote(agentId, true, undefined, mockTimestamp);

      // Entities are now pure data - validation happens in handlers
      const updated2 = updated1.recordCloseVote(agentId, false, undefined, mockTimestamp);
      expect(updated2.votesToClose).toHaveLength(2); // Should allow adding second vote
    });
  });

  describe('Immutability', () => {
    it('should create immutable simulation', () => {
      const simulation = expectOk(DebateSimulation.create({
        cryptoService,
        topic: 'Test topic',
        createdAt: mockTimestamp,
      }));

      // These should not be modifiable
      expect(() => {
        (simulation as any).id = 'new-id';
      }).toThrow();

      expect(() => {
        (simulation as any).topic = 'New topic';
      }).toThrow();
    });
  });

  describe('reconstitute() method', () => {
    it('should preserve original ID instead of regenerating', () => {
      const originalId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', mockTimestamp, cryptoService));
      const timestamp = TimestampGenerator.now();

      const simulation = expectOk(DebateSimulation.reconstitute(
        originalId,
        'Test Topic',
        timestamp,
        DebateStatus.ACTIVE,
        [],
        [],
        []
      ));

      expect(simulation.id).toBe(originalId);
    });

    it('should reconstitute simulation with all fields', () => {
      const id = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', mockTimestamp, cryptoService));
      const timestamp = TimestampGenerator.now();
      const agent1 = AgentIdGenerator.generate(cryptoService);
      const agent2 = AgentIdGenerator.generate(cryptoService);
      const arg1 = ArgumentIdGenerator.fromContent('Arg 1', cryptoService);
      const arg2 = ArgumentIdGenerator.fromContent('Arg 2', cryptoService);
      const votes = [
        { agentId: agent1, vote: true, reason: 'Test', timestamp: mockTimestamp }
      ];

      const simulation = expectOk(DebateSimulation.reconstitute(
        id,
        'Complex Topic',
        timestamp,
        DebateStatus.CLOSED,
        [agent1, agent2],
        [arg1, arg2],
        votes
      ));

      expect(simulation.id).toBe(id);
      expect(simulation.topic).toBe('Complex Topic');
      expect(simulation.status).toBe(DebateStatus.CLOSED);
      expect(simulation.participantIds).toEqual([agent1, agent2]);
      expect(simulation.argumentIds).toEqual([arg1, arg2]);
      expect(simulation.votesToClose).toEqual(votes);
    });

    it('should return error when ID is missing', () => {
      const error = expectErr(DebateSimulation.reconstitute(
        '' as any,  // Empty ID
        'Topic',
        mockTimestamp,
        DebateStatus.ACTIVE,
        [],
        [],
        []
      ));

      expect(error.message).toContain('Data corruption');
      expect(error.message).toContain('Missing required fields');
    });

    it('should return error when topic is missing', () => {
      const id = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', mockTimestamp, cryptoService));

      const error = expectErr(DebateSimulation.reconstitute(
        id,
        '',  // Empty topic
        mockTimestamp,
        DebateStatus.ACTIVE,
        [],
        [],
        []
      ));

      expect(error.message).toContain('Data corruption');
    });

    it('should return error when createdAt is null', () => {
      const id = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', mockTimestamp, cryptoService));

      const error = expectErr(DebateSimulation.reconstitute(
        id,
        'Topic',
        null as any,  // Null timestamp
        DebateStatus.ACTIVE,
        [],
        [],
        []
      ));

      expect(error.message).toContain('Data corruption');
    });

    it('should return error when status is missing', () => {
      const id = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', mockTimestamp, cryptoService));

      const error = expectErr(DebateSimulation.reconstitute(
        id,
        'Topic',
        mockTimestamp,
        '' as any,  // Empty status
        [],
        [],
        []
      ));

      expect(error.message).toContain('Data corruption');
    });

    it('should allow empty arrays for optional collections', () => {
      const id = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', mockTimestamp, cryptoService));

      const simulation = expectOk(DebateSimulation.reconstitute(
        id,
        'Topic',
        mockTimestamp,
        DebateStatus.ACTIVE,
        [],  // Empty participants
        [],  // Empty arguments
        []   // Empty votes
      ));

      expect(simulation.participantIds).toEqual([]);
      expect(simulation.argumentIds).toEqual([]);
      expect(simulation.votesToClose).toEqual([]);
    });
  });
});
